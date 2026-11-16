// Downloads text as a file and copies it to the clipboard (call from a click).
export function save(name: string, text: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  a.download = name;
  a.click();
  navigator.clipboard?.writeText(text).catch(() => {}); // download still works if clipboard is refused
}

export const stamp = () => new Date().toISOString().slice(0, 19).replace(/:/g, '-');
