const validationMiddleware = {
  email: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  password: (password) => {
    if (password.length < 8) return 'Min 8 characters';
    if (!/[A-Z]/.test(password)) return 'Need at least 1 uppercase letter';
    if (!/[0-9]/.test(password)) return 'Need at least 1 number';
    return null;
  },

  phone: (phone) => {
    return /^\d{10}$/.test(phone);
  },

  required: (value, label) => {
    return value && value.trim() ? null : `${label} is required`;
  },

  validateUserRegistration: (data) => {
    const errors = {};
    
    if (!data.firstName?.trim()) errors.firstName = 'First name is required';
    if (!data.lastName?.trim()) errors.lastName = 'Last name is required';
    if (!validationMiddleware.email(data.email)) errors.email = 'Invalid email address';
    if (!validationMiddleware.phone(data.phone)) errors.phone = 'Phone must be 10 digits';
    if (!data.country?.trim()) errors.country = 'Country is required';
    if (!data.role?.trim()) errors.role = 'Role is required';
    
    const pwdError = validationMiddleware.password(data.password);
    if (pwdError) errors.password = pwdError;

    return Object.keys(errors).length ? errors : null;
  },
};

module.exports = validationMiddleware;
