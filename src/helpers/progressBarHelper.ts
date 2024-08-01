/*

Prints a progressbar which looks like this:

Total progress   [█████████████████___] 86 %
 */
const relativeChunks = 40

const returnProgressBar = (progressChunks: number, totalChunks: number) => {
  // totalChunks can't be zero
  if (totalChunks <= 0) {
    // check if progess is equal to total chunks, if so, assign it to 1 as well
    if (progressChunks == totalChunks) {
      totalChunks = progressChunks = 1
    } else {
      totalChunks = 1
    }
  }

  // progress chunks can't be more than total chunks
  if (progressChunks > totalChunks) {
    progressChunks = totalChunks
  }

  // Calculate Progress Bar
  const perc = progressChunks / totalChunks

  const floatedRelativeChunks = perc * relativeChunks
  const fullRelativeChunks = Math.floor(floatedRelativeChunks)

  // IF WE EVER WANT TO PARTIAL
  // const partialRelativeChunkPerc = floatedRelativeChunks - fullRelativeChunks;
  // const partialRelativeChunks = partialRelativeChunkPerc * relativeChunks;

  let output = '['
  for (let i = 1; i <= relativeChunks; i++) {
    if (i <= fullRelativeChunks) {
      output += '█'
    } else {
      output += '_'
    }

    // IF WE EVER WANT TO PARTIAL
    // else if (i <= partialRelativeChunks) {
    //   if (partialRelativeChunks <= 0.25) {
    //     output += '_';
    //   } else if (partialRelativeChunks <= 0.5) {
    //     output += '░';
    //   } else if (partialRelativeChunks <= 0.75) {
    //     output += '▒';
    //   } else {
    //     output += '▓';
    //   }
    // }
  }
  output += `] ${Math.floor(perc * 100)}%`

  return output
}

export const printProgress = (
  progressChunks: number,
  totalChunks: number,
  prependText?: string,
  appendText?: string
) => {
  let output = ''

  if (prependText) {
    output = prependText.padEnd(40)
  }

  const progress = returnProgressBar(progressChunks, totalChunks)
  output += progress

  if (appendText) {
    output += ' '.repeat(5) + appendText
  }

  return output
}
