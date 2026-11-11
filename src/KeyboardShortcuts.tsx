const groups = [
  { title: 'Redacción', items: [
    ['Negrita / cursiva / subrayado', 'Ctrl + B / I / U'],
    ['Deshacer / rehacer', 'Ctrl + Z / Ctrl + Mayús + Z'],
    ['Título 1, 2 o 3 / texto normal', 'Ctrl + Alt + 1, 2, 3 / 0'],
    ['Alinear izquierda / centro / derecha / justificar', 'Ctrl + Mayús + L / E / R / J'],
    ['Lista con viñetas / numerada', 'Ctrl + Mayús + 8 / 7'],
    ['Aumentar / disminuir letra', 'Ctrl + Mayús + . / ,'],
    ['Salto de página', 'Ctrl + Enter'],
  ] },
  { title: 'Herramientas', items: [
    ['Insertar ecuación', 'Ctrl + Alt + E'],
    ['Referencias bibliográficas', 'Ctrl + Alt + R'],
    ['Insertar tabla', 'Ctrl + Alt + T'],
    ['Añadir comentario', 'Ctrl + Alt + M'],
    ['Buscar y reemplazar', 'Ctrl + F / H'],
    ['Despejar pantalla / volver', 'Ctrl + Mayús + Enter / Esc'],
    ['Ver estos atajos', 'Ctrl + Alt + K'],
  ] },
];
export default function KeyboardShortcuts() {
  return <div className="shortcut-guide"><p>En Mac, usa ⌘ en lugar de Ctrl y ⌥ para Alt. Los atajos de redacción actúan dentro del documento.</p>
    {groups.map(group=><section key={group.title}><h3>{group.title}</h3><dl>{group.items.map(([label,keys])=><div key={label}><dt>{label}</dt><dd><kbd>{keys}</kbd></dd></div>)}</dl></section>)}
    <p>Walkie-talkie: activa el canal y mantén Ctrl + Mayús + Espacio para hablar desde cualquier parte de Texla. Usa Control también en Mac. Al soltar cualquiera de las tres teclas, se detiene la transmisión. Con el botón de hablar enfocado, también puedes mantener Espacio o Enter.</p>
  </div>;
}
