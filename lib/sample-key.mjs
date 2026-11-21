// Server module. Never import into a client component.
export const sampleQuestions = [
  [
    "What form of energy is stored in sugars?",
    ["Sound", "Chemical", "Thermal", "Mechanical"],
    1,
    "Photosynthesis stores captured light energy as chemical energy in sugars.",
    "S1",
  ],
  [
    "Which colors does chlorophyll absorb most strongly?",
    ["Green and yellow", "Orange and green", "Blue and red", "Yellow and red"],
    2,
    "Chlorophyll absorbs most strongly in the blue and red regions.",
    "S2",
  ],
  [
    "Which molecule supplies the oxygen released by a leaf?",
    ["Water", "Carbon dioxide", "Glucose", "ATP"],
    0,
    "Splitting water releases oxygen during the light-dependent reactions.",
    "S3",
  ],
  [
    "Where does the Calvin cycle occur?",
    ["Thylakoid membrane", "Stoma", "Cell wall", "Stroma"],
    3,
    "The Calvin cycle occurs in the fluid surrounding the thylakoids.",
    "S4",
  ],
  [
    "What is a consequence of closing stomata?",
    [
      "Faster water loss",
      "Less carbon dioxide entry",
      "More blue light absorbed",
      "Greater oxygen release",
    ],
    1,
    "Closing the pores reduces water loss and limits gas exchange.",
    "S5",
  ],
].map(([prompt, options, correct, explanation, ref], i) => ({
  id: "q" + i,
  prompt,
  options,
  correct,
  explanation,
  refs: [ref],
}));
