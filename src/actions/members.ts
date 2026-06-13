'use server';

import { db } from '@/lib/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';

// 🔧 Helper Functions for Data Normalization
const normalizePhone = (phone: string): string => {
  // Remove all spaces and keep only digits and +
  return phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '');
};

const normalizeEmail = (email: string | null | undefined): string | null => {
  if (!email || email.trim() === '') return null;
  // Trim whitespace and convert to lowercase for case-insensitive comparison
  return email.trim().toLowerCase();
};

export async function getMemberPoints() {
  const session = await auth();
  if (!session || session.user.role !== 'MEMBER') {
    throw new Error('Unauthorized');
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { points: true },
  });

  return user?.points || 0;
}

export async function getPointsHistory() {
  const session = await auth();
  if (!session || session.user.role !== 'MEMBER') {
    throw new Error('Unauthorized');
  }

  const history = await db.pointHistory.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return history;
}

export async function getPurchaseHistory() {
  const session = await auth();
  if (!session || session.user.role !== 'MEMBER') {
    throw new Error('Unauthorized');
  }

  const purchases = await db.sale.findMany({
    where: { customerId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: true,
            },
          },
        },
      },
    },
  });

  return purchases;
}

export async function redeemPoints(points: number, description: string) {
  const session = await auth();
  if (!session || session.user.role !== 'MEMBER') {
    throw new Error('Unauthorized');
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user || user.points < points) {
    throw new Error('Insufficient points');
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { points: { decrement: points } },
  });

  await db.pointHistory.create({
    data: {
      userId: session.user.id,
      points: -points,
      type: 'REDEEMED',
      description,
    },
  });

  return true;
}

export async function getAllCustomers() {
  const session = await auth();
  if (!session || (session.user.role !== 'ADMINISTRATOR' && session.user.role !== 'MANAGER')) {
    throw new Error('Unauthorized');
  }

  const customers = await db.user.findMany({
    where: { role: 'MEMBER' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      birthday: true,
      photoUrl: true,
      points: true,
      createdAt: true,
    },
  });

  return customers;
}

export async function getCustomerDetails(customerId: string) {
  const session = await auth();
  if (!session || (session.user.role !== 'ADMINISTRATOR' && session.user.role !== 'MANAGER')) {
    throw new Error('Unauthorized');
  }

  const customer = await db.user.findUnique({
    where: { id: customerId, role: 'MEMBER' },
    include: {
      sales: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          items: {
            include: {
              variant: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
      },
      pointsHistory: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  return customer;
}

export async function createCustomerAction(formData: FormData) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'ADMINISTRATOR') {
      return { success: false, error: 'Unauthorized - Admin access required' };
    }

    const name = formData.get('name') as string;
    const rawEmail = formData.get('email') as string;
    const password = formData.get('password') as string;
    const rawPhone = formData.get('phone') as string;
    const address = formData.get('address') as string;
    const birthday = formData.get('birthday') as string;
    const photoUrl = formData.get('photoUrl') as string;

    // 🔧 Normalize phone and email
    const phone = normalizePhone(rawPhone);
    const email = normalizeEmail(rawEmail);

    // Validation
    if (!name || !phone || !password || !address) {
      return { success: false, error: 'Nama, telepon, password, dan alamat wajib diisi' };
    }

    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }

    // Validate phone number format
    if (phone.length < 10 || phone.length > 15) {
      return { success: false, error: 'Please enter a valid phone number' };
    }

    // ✅ Check for duplicate phone (now checks against normalized phone numbers)
    const existingPhone = await db.user.findFirst({
      where: { phone },
    });

    if (existingPhone) {
      return { success: false, error: 'Phone number already registered' };
    }

    // ✅ Check for duplicate email (case-insensitive, if provided)
    if (email) {
      const existingEmail = await db.user.findFirst({
        where: { email },
      });

      if (existingEmail) {
        return { success: false, error: 'Email already registered' };
      }
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    // ✅ Create customer with normalized data
    await db.user.create({
      data: {
        name,
        phone,        // ✅ Saved without spaces: "081234567890"
        password: hashedPassword,
        email,        // ✅ Saved trimmed & lowercase: "john@example.com"
        address: address || null,
        birthday: birthday ? new Date(birthday) : null,
        photoUrl: photoUrl || null,
        role: 'MEMBER',
        points: 0,
      },
    });

    revalidatePath('/admin/customers');
    revalidatePath('/manager/customers');
    return { success: true };
  } catch (error) {
    console.error('Create customer error:', error);
    return { success: false, error: 'Failed to create customer' };
  }
}

export async function updateCustomerAction(id: string, formData: FormData) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'ADMINISTRATOR') {
      return { success: false, error: 'Unauthorized - Admin access required' };
    }

    const name = formData.get('name') as string;
    const rawEmail = formData.get('email') as string;
    const rawPhone = formData.get('phone') as string;
    const address = formData.get('address') as string;
    const birthday = formData.get('birthday') as string;
    const photoUrl = formData.get('photoUrl') as string;
    const newPassword = formData.get('password') as string;
    const points = formData.get('points') ? parseInt(formData.get('points') as string) : undefined;
    const pointsReason = formData.get('pointsReason') as string;

    // 🔧 Normalize phone and email
    const phone = normalizePhone(rawPhone);
    const email = normalizeEmail(rawEmail);

    // Validation
    if (!name || !phone || !address) {
      return { success: false, error: 'Nama, telepon, dan alamat wajib diisi' };
    }

    // Validate password length if provided
    if (newPassword && newPassword.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }

    // Validate phone number format
    if (phone.length < 10 || phone.length > 15) {
      return { success: false, error: 'Please enter a valid phone number' };
    }

    // ✅ Check for duplicate phone on different user (normalized)
    const existingUser = await db.user.findFirst({
      where: {
        phone,
        id: { not: id }
      },
    });

    if (existingUser) {
      return { success: false, error: 'Phone already exists' };
    }

    // ✅ Check for duplicate email on different user (case-insensitive, if provided)
    if (email) {
      const existingEmailUser = await db.user.findFirst({
        where: {
          email,
          id: { not: id }
        },
      });

      if (existingEmailUser) {
        return { success: false, error: 'Email already registered' };
      }
    }

    if (address && address.length > 120) {
      return { success: false, error: 'Address cannot exceed 200 characters' };
    }

    // Get current user data to track changes
    const currentUser = await db.user.findUnique({
      where: { id, role: 'MEMBER' },
      select: { points: true, name: true },
    });

    if (!currentUser) {
      return { success: false, error: 'Customer not found' };
    }

    // ✅ Prepare update data with normalized values
    const updateData: any = {
      name,
      phone,        // ✅ Saved without spaces: "081234567890"
      email,        // ✅ Saved trimmed & lowercase: "john@example.com"
      address: address || null,
      birthday: birthday ? new Date(birthday) : null,
      photoUrl: photoUrl || null,
    };

    // Hash password if provided
    if (newPassword && newPassword.trim() !== '') {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      updateData.password = hashedPassword;
    }

    // Update points if changed
    if (points !== undefined && points !== currentUser.points) {
      // Validate that reason is provided when points are changed
      if (!pointsReason || pointsReason.trim() === '') {
        return { success: false, error: 'Reason is required when updating loyalty points' };
      }

      updateData.points = points;

      // Calculate points difference
      const pointsDifference = points - currentUser.points;

      // Create point history record with custom reason
      await db.pointHistory.create({
        data: {
          userId: id,
          points: pointsDifference,
          type: 'ADJUSTED',
          description: pointsReason,
        },
      });
    }

    // Update user
    await db.user.update({
      where: { id },
      data: updateData,
    });

    revalidatePath('/admin/customers');
    revalidatePath('/manager/customers');
    return { success: true };
  } catch (error) {
    console.error('Update customer error:', error);
    return { success: false, error: 'Failed to update customer' };
  }
}

export async function deleteCustomerAction(id: string) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'ADMINISTRATOR') {
      return { success: false, error: 'Unauthorized - Admin access required' };
    }

    // Check if customer has sales
    const salesCount = await db.sale.count({
      where: { customerId: id },
    });

    if (salesCount > 0) {
      return { success: false, error: 'Cannot delete customer with existing sales' };
    }

    await db.user.delete({
      where: { id, role: 'MEMBER' },
    });

    revalidatePath('/admin/customers');
    revalidatePath('/manager/customers');
    return { success: true };
  } catch (error) {
    console.error('Delete customer error:', error);
    return { success: false, error: 'Failed to delete customer' };
  }
}

export async function getCustomerPointsHistory(customerId: string, page: number = 1, pageSize: number = 10) {
  const session = await auth();
  if (!session || (session.user.role !== 'ADMINISTRATOR' && session.user.role !== 'MANAGER')) {
    throw new Error('Unauthorized');
  }

  const skip = (page - 1) * pageSize;

  const [history, total] = await Promise.all([
    db.pointHistory.findMany({
      where: { userId: customerId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    db.pointHistory.count({
      where: { userId: customerId },
    }),
  ]);

  return { history, total };
}