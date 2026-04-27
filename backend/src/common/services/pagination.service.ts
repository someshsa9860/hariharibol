import { Injectable } from '@nestjs/common';

export interface PaginationParams {
  skip?: number;
  take?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  skip: number;
  take: number;
  hasMore: boolean;
  pageCount: number;
}

@Injectable()
export class PaginationService {
  /**
   * Normalize pagination parameters with safe defaults
   */
  normalize(params: PaginationParams): Required<PaginationParams> {
    let skip = Math.max(0, params.skip || 0);
    let take = Math.max(1, Math.min(100, params.take || 20)); // Min 1, max 100

    return { skip, take };
  }

  /**
   * Build paginated response
   */
  paginate<T>(
    data: T[],
    total: number,
    skip: number,
    take: number,
  ): PaginatedResult<T> {
    return {
      data,
      total,
      skip,
      take,
      hasMore: skip + take < total,
      pageCount: Math.ceil(total / take),
    };
  }

  /**
   * Calculate offset for database queries
   */
  calculateOffset(page: number, pageSize: number): number {
    return Math.max(0, (page - 1) * pageSize);
  }

  /**
   * Get safe page size with limits
   */
  getSafePageSize(requested?: number): number {
    const DEFAULT_PAGE_SIZE = 20;
    const MAX_PAGE_SIZE = 100;
    const MIN_PAGE_SIZE = 1;

    if (!requested) return DEFAULT_PAGE_SIZE;
    return Math.max(MIN_PAGE_SIZE, Math.min(MAX_PAGE_SIZE, requested));
  }

  /**
   * Check if pagination params are valid
   */
  isValid(params: PaginationParams): boolean {
    if (params.skip !== undefined && params.skip < 0) return false;
    if (params.take !== undefined && params.take < 1) return false;
    if (params.take !== undefined && params.take > 100) return false;
    return true;
  }
}
