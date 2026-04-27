'use client';

import Sidebar from '@/components/Sidebar';
import { Lock, Bell, Palette } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 bg-gray-50 min-h-screen p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Settings</h1>

          <div className="space-y-6">
            {/* Security */}
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-4">
                <Lock className="text-primary" size={24} />
                <h2 className="text-xl font-bold">Security</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Two-Factor Authentication
                  </label>
                  <button className="btn-primary">Enable 2FA</button>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Change Password
                  </label>
                  <button className="btn-secondary">Change</button>
                </div>
              </div>
            </div>

            {/* Notifications */}
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-4">
                <Bell className="text-primary" size={24} />
                <h2 className="text-xl font-bold">Notifications</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label>Email notifications for new moderation items</label>
                  <input type="checkbox" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <label>Alert on user bans</label>
                  <input type="checkbox" defaultChecked />
                </div>
              </div>
            </div>

            {/* Appearance */}
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-4">
                <Palette className="text-primary" size={24} />
                <h2 className="text-xl font-bold">Appearance</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Theme</label>
                  <select className="input-field">
                    <option>Light</option>
                    <option>Dark</option>
                    <option>Auto</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
