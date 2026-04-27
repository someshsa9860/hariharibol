class Validators {
  static String? validateEmail(String? value) {
    if (value == null || value.isEmpty) {
      return 'Email is required';
    }
    // Add email regex validation
    return null;
  }

  // Add more validators
}