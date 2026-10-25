import { useEffect, useRef } from 'react';
import { MathfieldElement } from 'mathlive';
MathfieldElement.fontsDirectory = `${import.meta.env.BASE_URL}mathlive-fonts`;
MathfieldElement.soundsDirectory = null;
export default function MathInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
 const host = useRef<HTMLDivElement>(null); const field = useRef<MathfieldElement | null>(null); const callback = useRef(onChange); callback.current = onChange;
 useEffect(() => { const element = new MathfieldElement(); element.mathVirtualKeyboardPolicy = 'manual'; element.setAttribute('aria-label', 'Editor visual de ecuaciones'); element.value = value; element.addEventListener('input', () => callback.current(element.value)); host.current?.appendChild(element); field.current = element; return () => { element.remove(); field.current = null; }; }, []);
 useEffect(() => { if (field.current && field.current.value !== value) field.current.value = value; }, [value]);
 return <div className="math-input" ref={host}/>;
}
