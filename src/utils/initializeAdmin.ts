/**
 * Initialize admin account in localStorage
 * This ensures the admin account exists when the app loads
 */

export function initializeAdminAccount() {
  try {
    const storedUsers = JSON.parse(localStorage.getItem('fursure_users') || '{}');
    
    // Admin account credentials
    const adminEmail = 'admin_test@gmail.com';
    const adminPassword = 'test123';
    
    // Check if admin already exists
    if (storedUsers[adminEmail]) {
      // Admin exists, ensure it has the correct role
      if (storedUsers[adminEmail].role !== 'vet') {
        storedUsers[adminEmail].role = 'vet';
        localStorage.setItem('fursure_users', JSON.stringify(storedUsers));
      }
      return;
    }

    // Create admin account
    storedUsers[adminEmail] = {
      username: adminEmail,
      email: adminEmail,
      password: adminPassword,
      role: 'vet', // 'vet' is the admin role
      firstName: 'Admin',
      lastName: 'User',
      phone: '',
      address: '',
    };

    localStorage.setItem('fursure_users', JSON.stringify(storedUsers));
    console.log('✅ Admin account initialized');
  } catch (error) {
    console.error('Error initializing admin account:', error);
  }
}

