class User {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.phone = data.phone;
    this.email = data.email;
    this.password = data.password;
    this.employment_status = data.employment_status;
    this.monthly_income = data.monthly_income;
    this.is_verified = data.is_verified || false;
    this.is_admin = data.is_admin || false;
    this.created_at = data.created_at || new Date();
    this.updated_at = data.updated_at || new Date();
  }

  toJSON() {
    const { password, ...user } = this;
    return user;
  }
}

module.exports = User;
