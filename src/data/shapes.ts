export interface BuiltinShape {
  id: string;
  name: string;
  category: string;
  svg: string;
}

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${body}</svg>`;

export const BUILTIN_SHAPES: BuiltinShape[] = [
  {
    id: "heart",
    name: "Corazón",
    category: "Clásicos",
    svg: svg(`
      <path fill="#111" d="M50 87C42 78 16 61 16 40C16 27 26 18 38 18C44 18 48 21 50 25C52 21 56 18 62 18C74 18 84 27 84 40C84 61 58 78 50 87Z"/>
      <path fill="#111" d="M50 66C46 61 33 53 33 43C33 37 38 33 43 33C46 33 49 35 50 37C51 35 54 33 57 33C62 33 67 37 67 43C67 53 54 61 50 66Z"/>
    `),
  },
  {
    id: "star",
    name: "Estrella",
    category: "Clásicos",
    svg: svg(`
      <path fill="#111" d="M50 8L61 34L90 37L68 56L75 84L50 69L25 84L32 56L10 37L39 34Z"/>
      <circle fill="#111" cx="50" cy="49" r="8"/>
    `),
  },
  {
    id: "dino",
    name: "Dino",
    category: "Animales",
    svg: svg(`
      <path fill="#111" d="M9 65C12 51 23 47 33 49C39 40 50 37 58 42C63 35 72 34 78 39L86 31L89 40L83 46C87 54 84 65 75 71L78 83L68 80L65 72C57 77 47 77 39 72L31 82L26 72C18 71 12 69 9 65Z"/>
      <circle fill="#111" cx="74" cy="43" r="2.4"/>
      <path fill="#111" d="M33 53C37 54 40 57 41 60L36 62C34 59 32 56 33 53Z"/>
      <path fill="#111" d="M49 45C52 47 54 50 54 53L50 54C49 51 48 48 49 45Z"/>
    `),
  },
];
