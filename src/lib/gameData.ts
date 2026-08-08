import { Level } from './types';

export const LEVELS: Level[] = [
  {
    id: 1,
    name: 'Principiante',
    description: 'Palabras cortas de 3-4 letras. ¡Ideal para empezar!',
    words: ['MAMA', 'PAPA', 'SOL', 'MAR', 'DIA', 'OJO', 'PAN', 'PES'],
    requiredScore: 0,
    unlocked: true,
  },
  {
    id: 2,
    name: 'Intermedio',
    description: 'Palabras de 4-5 letras. Más desafío.',
    words: ['HOLA', 'AGUA', 'CASA', 'FLOR', 'LIBRO', 'PERRO', 'GATO', 'LECHE'],
    requiredScore: 200,
    unlocked: false,
  },
  {
    id: 3,
    name: 'Avanzado',
    description: 'Palabras largas de 6+ letras. ¡Pon a prueba tu habilidad!',
    words: ['FAMILIA', 'ESCUELA', 'AMIGOS', 'LENGUA', 'MANOS', 'MUNDO', 'CORAZON'],
    requiredScore: 500,
    unlocked: false,
  },
  {
    id: 4,
    name: 'Experto',
    description: 'Oraciones completas. ¡Domina el lenguaje de señas!',
    words: ['BUENOS DIAS', 'GRACIAS', 'POR FAVOR', 'TE QUIERO', 'BIENVENIDO'],
    requiredScore: 1000,
    unlocked: false,
  },
];

export function getLevelById(levelId: number): Level | undefined {
  return LEVELS.find((l) => l.id === levelId);
}

export function getWordForLevel(levelId: number, wordIndex: number): string {
  const level = getLevelById(levelId);
  if (!level) return '';
  return level.words[wordIndex % level.words.length];
}

export function getLetters(word: string): string[] {
  // Remove spaces and split into individual letters
  return word.replace(/\s/g, '').split('');
}

// Movement-based letters (common in sign language alphabets)
export const MOVEMENT_LETTERS: Record<string, { type: string; description: string }> = {
  J: { type: 'circular', description: 'Traza una J en el aire con el dedo índice' },
  Z: { type: 'zigzag', description: 'Traza una Z en el aire con el dedo índice' },
};
