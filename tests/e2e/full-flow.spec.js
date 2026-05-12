const { test, expect } = require('@playwright/test');

test('pełny przepływ: rejestracja → logowanie → CRUD notatek → wylogowanie', async ({ page }) => {
  const username = `e2e_${Date.now()}`;
  const password = 'haslo123';
  const noteTitle = 'Moja testowa notatka';
  const noteContent = 'Treść wpisana przez Playwright';
  const updatedTitle = 'Zaktualizowana notatka';

  await page.goto('/');

  // ── 1. Rejestracja ──────────────────────────────────────────────────────────
  await expect(page.locator('#auth-section')).toBeVisible();

  // przełącz na tryb rejestracji
  await page.locator('#auth-toggle-link').click();
  await expect(page.locator('#auth-title')).toHaveText('Rejestracja');

  await page.locator('#auth-username').fill(username);
  await page.locator('#auth-password').fill(password);
  await page.locator('#auth-submit').click();

  // po rejestracji jesteśmy od razu zalogowani
  await expect(page.locator('#notes-section')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#username-display')).toHaveText(username);

  // ── 2. Wylogowanie i ponowne logowanie ──────────────────────────────────────
  await page.locator('#btn-logout').click();
  await expect(page.locator('#auth-section')).toBeVisible();

  // tryb logowania (domyślny)
  await expect(page.locator('#auth-title')).toHaveText('Logowanie');
  await page.locator('#auth-username').fill(username);
  await page.locator('#auth-password').fill(password);
  await page.locator('#auth-submit').click();

  await expect(page.locator('#notes-section')).toBeVisible({ timeout: 10_000 });

  // ── 3. Dodanie notatki ──────────────────────────────────────────────────────
  await page.locator('#new-title').fill(noteTitle);
  await page.locator('#new-content').fill(noteContent);
  await page.locator('#add-note-form button[type="submit"]').click();

  // notatka pojawia się na liście
  await expect(page.locator('.note-card')).toHaveCount(1, { timeout: 5_000 });
  await expect(page.locator('.note-card h3')).toContainText(noteTitle);
  await expect(page.locator('.note-card p')).toContainText(noteContent);

  // empty state ukryty
  await expect(page.locator('#empty-state')).toBeHidden();

  // ── 4. Edycja notatki ───────────────────────────────────────────────────────
  await page.locator('.btn-edit').click();
  await expect(page.locator('#modal-overlay')).toHaveClass(/open/);

  await page.locator('#edit-title').fill(updatedTitle);
  await page.locator('#modal-save').click();

  // modal zamknięty, tytuł zaktualizowany
  await expect(page.locator('#modal-overlay')).not.toHaveClass(/open/, { timeout: 5_000 });
  await expect(page.locator('.note-card h3')).toContainText(updatedTitle);

  // ── 5. Usunięcie notatki ────────────────────────────────────────────────────
  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('.btn-delete').click();

  // notatka znika, pojawia się empty state
  await expect(page.locator('.note-card')).toHaveCount(0, { timeout: 5_000 });
  await expect(page.locator('#empty-state')).toBeVisible();

  // ── 6. Wylogowanie ──────────────────────────────────────────────────────────
  await page.locator('#btn-logout').click();
  await expect(page.locator('#auth-section')).toBeVisible();
  await expect(page.locator('#notes-section')).toBeHidden();
});
