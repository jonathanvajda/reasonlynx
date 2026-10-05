import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID } from '../../packages/indexeddb-data-management/src/index.js';
import {
  getSelectedTomProjectId,
  resetTomProjectStorageForTests,
  selectTomProject
} from './tom-project-storage.js';

test('TOM persistence follows the shared project selected by an operation', () => {
  resetTomProjectStorageForTests();
  assert.equal(getSelectedTomProjectId(), DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID);
  selectTomProject('project:research');
  assert.equal(getSelectedTomProjectId(), 'project:research');
  resetTomProjectStorageForTests();
  assert.equal(getSelectedTomProjectId(), DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID);
});
