// Fixture: naming convention violations

// Function naming (should be camelCase)
export function ProcessData() {
  return null;
}

export function get_user_name() {
  return '';
}

export const HANDLE_REQUEST = () => {};

// Class naming (should be PascalCase)
class user_service {
  getData() { return null; }
}

class myController {
  handle() { return null; }
}

interface data_model {
  id: string;
}

// Constant naming (should be UPPER_SNAKE)
export const maxRetries = 3;
export const api_version = "v2";
