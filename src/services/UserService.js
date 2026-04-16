const userRepository = require('../repositories/UserRepository');

class UserService {
  async registerUser(username, phone) {
    if (!username || !phone) {
      const error = new Error('Username and phone are required');
      error.status = 400;
      throw error;
    }

    if (username.length < 3 || username.length > 30) {
      const error = new Error('Username must be between 3 and 30 characters');
      error.status = 400;
      throw error;
    }

    const phoneRegex = /^\+?[\d\s-]{10,15}$/;
    if (!phoneRegex.test(phone)) {
      const error = new Error('Invalid phone number format');
      error.status = 400;
      throw error;
    }

    const existingUser = await userRepository.findByUsername(username);
    if (existingUser) {
      const error = new Error('Username already exists');
      error.status = 409;
      throw error;
    }

    return await userRepository.create(username, phone);
  }

  async getAllUsers() {
    return await userRepository.findAll();
  }

  async getUserById(id) {
    const user = await userRepository.findById(id);
    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }
    return user;
  }

  async deleteUser(id) {
    const user = await userRepository.delete(id);
    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }
    return user;
  }
}

module.exports = new UserService();
