export type Role = 'ADMIN' | 'PM' | 'DEVELOPER';
export type User = { id: string; name: string; email: string; role: Role };
export type Task = { id: number; title: string; description?: string; status: string; priority: string; dueDate: string; overdue: boolean; developer: { id: string; name: string } ; project?: { id: string; name: string } };
export type Activity = { id: string; message: string; createdAt: string; user?: { name: string } };
