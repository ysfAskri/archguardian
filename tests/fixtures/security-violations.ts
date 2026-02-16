// Fixture: various security violations for testing

import { readFile } from 'fs';

// Hardcoded secrets (intentionally fake for testing — archguard should flag these)
const API_KEY = "sk_test_FAKE_KEY_FOR_TESTING_00000";
const aws_key = "AKIAEXAMPLEKEYONLY1234";
const password = "super_secret_password_123";
const dbUrl = "postgres://admin:password123@db.example.com:5432/mydb";
const github_token = "ghp_FAKE000000000000000000000000000000TEST";
const slack_token = "xoxb-0000000000-faketoken0";

// SQL injection
export function getUser(id: string) {
  const query = `SELECT * FROM users WHERE id = ${id}`;
  return db.execute(query);
}

export function searchUsers(name: string) {
  const query = "SELECT * FROM users WHERE name = '" + name + "'";
  return db.execute(query);
}

// XSS
export function renderContent(html: string) {
  document.getElementById('app')!.innerHTML = html;
}

export function writeContent(html: string) {
  document.write(html);
}

// eval
export function dynamicExec(code: string) {
  return eval(code);
}

export function dynamicFunc(code: string) {
  return new Function(code)();
}
