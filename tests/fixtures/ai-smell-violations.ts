// Fixture: AI-generated code smells

import { readFile } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { unusedHelper } from './helpers';
import { unusedUtil } from './utils';

// This function processes user data
// It takes a user object as input
// First it validates the user
// Then it transforms the data
// Finally it saves to the database
// We need to handle all edge cases
// Make sure to log everything
// Return the result to the caller
export function processUser(user: any) {
  return user;
}

// Verbose error handling
export async function fetchData(url: string) {
  try {
    const res = await fetch(url);
    return res.json();
  } catch (error) {
    console.error('An error occurred while fetching data');
    console.error('The URL that was being fetched:', url);
    console.error('The error message:', (error as Error).message);
    console.error('The error stack:', (error as Error).stack);
    console.error('Please check the network connection');
    console.error('Also verify the URL is correct');
    console.error('If the problem persists, contact support');
    console.error('Error timestamp:', new Date().toISOString());
    console.error('Returning null as fallback');
    return null;
  }
}

const value = "hello" as any;
