const processIntermediateLanguage = (content) => {
  const stages = []

  content.forEach(element => {
    if (element.type === 'command') {
     stages.push({commands: element}) 
    }

    if (element.type === 'line') {
      stages[stages.length-1]['content'] = element
    }
  })

  return stages
}

module.exports = {
  processIntermediateLanguage
}