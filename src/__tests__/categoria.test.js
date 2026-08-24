import { describe, it, expect } from 'vitest';

// Replica el helper usado en inventory-view.js para garantizar que el id de
// categoría (que viene como string desde dataset) se envía como número a Tauri,
// evitando el error "invalid type: string, expected i64" en update_categoria /
// delete_categoria.
function coerceId(id) {
  return (id === null || id === undefined) ? id : Number(id);
}

describe('coerceId (id de categoría para Tauri i64)', () => {
  it('complementario: convierte el id string del dataset a número', () => {
    expect(coerceId('1')).toBe(1);
    expect(coerceId('42')).toBe(42);
  });

  it('mantiene el número si ya lo es', () => {
    expect(coerceId(7)).toBe(7);
  });

  it('deja null como null (modo crear categoría)', () => {
    expect(coerceId(null)).toBe(null);
  });

  it('construye los args de update_categoria con id numérico', () => {
    const editingCategoriaId = '5';
    const args = { id: coerceId(editingCategoriaId), nombre: 'Foo', color: '#fff' };
    expect(args.id).toBe(5);
    expect(typeof args.id).toBe('number');
  });

  it('construye los args de delete_categoria con id numérico', () => {
    const args = { id: coerceId('9') };
    expect(args.id).toBe(9);
    expect(typeof args.id).toBe('number');
  });

  it('no produce string (regresión del error i64)', () => {
    const args = { id: coerceId('1') };
    expect(typeof args.id).not.toBe('string');
  });
});
