import { test, expect } from '@playwright/test';
test('justification applies to paragraphs, persists, prints and is available on mobile', async ({ page }) => {
 await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/');
 const paragraph = page.locator('.tiptap p').filter({ hasText: 'Toda gran idea merece' });
 await paragraph.click();
 await page.getByRole('button', { name: 'Justificar (Ctrl+Mayús+J)', exact: true }).click();
 await expect(paragraph).toHaveCSS('text-align', 'justify');
 await expect(page.getByRole('button', { name: 'Justificar (Ctrl+Mayús+J)' })).toHaveClass(/active/);
 await page.waitForTimeout(600); await page.reload();
 await expect(paragraph).toHaveCSS('text-align', 'justify');
 await page.emulateMedia({ media: 'print' });
 await expect(paragraph).toHaveCSS('text-align', 'justify');
 await page.emulateMedia({ media: 'screen' });
 await page.setViewportSize({ width: 390, height: 844 }); await paragraph.click();
 const alignment = page.getByRole('combobox', { name: 'Alineación del párrafo' });
 await expect(alignment).toBeVisible(); await expect(alignment).toHaveValue('justify');
 await alignment.selectOption('left'); await expect(paragraph).toHaveCSS('text-align', 'left');
 // Separate the two format changes into distinct undo groups.
 await page.waitForTimeout(600);
 await alignment.selectOption('justify'); await expect(paragraph).toHaveCSS('text-align', 'justify');
 await page.waitForTimeout(600); await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
 await expect(paragraph).toHaveCSS('text-align', 'left');
});
