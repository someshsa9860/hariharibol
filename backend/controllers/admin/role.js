// Roles and permissions.
//
// Four standard roles are seeded — user, moderator, admin, super_admin — and
// marked `isSystem` so they cannot be deleted from the panel. Deleting the role
// every account points at is not a mistake worth leaving available.
//
// Permissions themselves are code, not data: they are the strings the routes
// check, so a permission that is not in config/constants.js guards nothing.
// The panel can assign them; it cannot invent them.

import { prisma } from '../../config/database.js';
import * as authService from '../../services/auth.js';
import * as audit from '../../services/audit.js';
import { ok, created, noContent } from '../../utils/respond.js';
import { notFound, badRequest, conflict } from '../../utils/errors.js';
import { PERMISSIONS } from '../../config/constants.js';

/** GET /api/admin/roles */
export const list = async (req, res) => {
  const roles = await prisma.role.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      permissions: { include: { permission: { select: { slug: true, name: true, group: true } } } },
      _count: { select: { users: true } },
    },
  });

  return ok(
    res,
    roles.map((role) => ({
      id: role.id,
      slug: role.slug,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      userCount: role._count.users,
      permissions: role.permissions.map((rp) => rp.permission),
    }))
  );
};

/**
 * GET /api/admin/permissions
 * The whole catalogue, grouped — what the role editor renders its checkboxes
 * from.
 */
export const permissions = async (req, res) => {
  const rows = await prisma.permission.findMany({ orderBy: [{ group: 'asc' }, { slug: 'asc' }] });

  const grouped = rows.reduce((groups, row) => {
    groups[row.group] = groups[row.group] || [];
    groups[row.group].push({ id: row.id, slug: row.slug, name: row.name, description: row.description });
    return groups;
  }, {});

  return ok(res, { groups: grouped, total: rows.length });
};

/** POST /api/admin/roles */
export const create = async (req, res) => {
  const { slug, name, description, permissions = [] } = req.valid.body;

  const existing = await prisma.role.findUnique({ where: { slug } });
  if (existing) throw conflict(`A role with the slug "${slug}" already exists`);

  const unknown = permissions.filter((p) => !PERMISSIONS[p]);
  if (unknown.length) throw badRequest(`Unknown permissions: ${unknown.join(', ')}`);

  const permissionRows = await prisma.permission.findMany({ where: { slug: { in: permissions } } });

  const role = await prisma.role.create({
    data: {
      slug,
      name,
      description,
      permissions: { create: permissionRows.map((p) => ({ permissionId: p.id })) },
    },
    include: { permissions: { include: { permission: true } } },
  });

  await audit.record(req, {
    action: 'role.create',
    entityType: 'Role',
    entityId: role.id,
    after: { slug, name, permissions },
  });

  return created(res, role);
};

/**
 * PATCH /api/admin/roles/:id
 * Replaces the permission set outright rather than diffing it. A checkbox list
 * is what the panel sends, and applying it as a whole is the only way an
 * unchecked box actually removes anything.
 */
export const update = async (req, res) => {
  const { name, description, permissions } = req.valid.body;

  const role = await prisma.role.findUnique({
    where: { id: req.valid.params.id },
    include: { permissions: { include: { permission: true } } },
  });
  if (!role) throw notFound('Role');

  const before = {
    name: role.name,
    permissions: role.permissions.map((rp) => rp.permission.slug),
  };

  if (permissions) {
    const unknown = permissions.filter((p) => !PERMISSIONS[p]);
    if (unknown.length) throw badRequest(`Unknown permissions: ${unknown.join(', ')}`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.role.update({ where: { id: role.id }, data: { name, description } });

    if (permissions) {
      const rows = await tx.permission.findMany({ where: { slug: { in: permissions } } });
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      await tx.rolePermission.createMany({
        data: rows.map((p) => ({ roleId: role.id, permissionId: p.id })),
      });
    }

    return tx.role.findUnique({
      where: { id: role.id },
      include: { permissions: { include: { permission: true } } },
    });
  });

  // Everyone holding this role has a cached permission set that is now wrong.
  await authService.invalidateRole(role.id);

  await audit.record(req, {
    action: 'role.update',
    entityType: 'Role',
    entityId: role.id,
    before,
    after: { name, permissions },
  });

  return ok(res, updated);
};

/** DELETE /api/admin/roles/:id */
export const remove = async (req, res) => {
  const role = await prisma.role.findUnique({
    where: { id: req.valid.params.id },
    include: { _count: { select: { users: true } } },
  });
  if (!role) throw notFound('Role');

  if (role.isSystem) throw badRequest('System roles cannot be deleted');
  if (role._count.users > 0) {
    throw badRequest(
      `${role._count.users} account(s) still have this role. Move them to another role first.`
    );
  }

  await prisma.role.delete({ where: { id: role.id } });
  await audit.record(req, { action: 'role.delete', entityType: 'Role', entityId: role.id, before: role });

  return noContent(res);
};
