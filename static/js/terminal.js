/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */

async function handleCommandInput () {
  function submitOutputAndClearInput (output) {
    const terminal = document.querySelector('#response')
    const commandInput = document.querySelector('#commandInput')
    terminal.innerHTML += `$ ${commandInput.value}\n\n${output || ''}\n`
    terminal.scrollTop = terminal.scrollHeight
    commandInput.value = ''
  }

  const commandInput = document.querySelector('#commandInput')

  if (commandInput.value === '') {
    submitOutputAndClearInput()
    return
  }

  const response = await fetch('http://127.0.0.1:8080/command', {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ command: commandInput.value })
  })

  const responseObj = await response.json()

  submitOutputAndClearInput(responseObj.commandOutput)

  if (responseObj.newContent) {
    await fetchNewContent()
  }
}

function fetchNewContent () {
  setInterval(async () => {
    const response = await fetch('http://127.0.0.1:8080/htmlcontent', {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    const contentWindow = document.querySelector('.markdown-body')

    if (response.status === 404) {
      document.querySelector('#blur-page').style.display = 'block'
      document.querySelector('#loading-spinner').style.display = 'block'
    } else {
      // If the user has pressed one of the buttons that shows the modal,
      // then it's possible for the blur page to be open and then closed
      // by the modal, so do nothing if a modal is open

      if (!historyModalOpen && !restartModalOpen) {
        document.querySelector('#blur-page').style.display = 'none'
      }

      document.querySelector('#loading-spinner').style.display = 'none'
    }
    contentWindow.innerHTML = await response.text()
  }, 200)
}

let historyModalOpen = false

async function showHistoryModal () {
  if (historyModalOpen) {
    closeHistoryModal()
    return
  }

  historyModalOpen = true
  const response = await fetch('http://127.0.0.1:8080/history', {
    method: 'GET',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (response.status === 204) {
    console.log('No current History')
  }

  try {
    const content = await response.json()
    const historyContainer = document.querySelector('#history-content')

    const startTime = document.createElement('p')
    startTime.id = 'start-time'
    startTime.innerHTML = `Content Started ${new Date(content[content.length - 1].startTime).toGMTString()}`
    historyContainer.appendChild(startTime)

    for (let i = content.length - 1; i >= 0; i--) {
      const newElement = document.createElement('div')
      const spacer = document.createElement('div')
      const commandAttempts = document.createElement('ul')
      const duration = document.createElement('div')

      spacer.className = 'history-spacer'
      newElement.className = 'history-element'
      document.className = 'history-attempts'

      newElement.innerHTML += `Started Chunk at ${new Date(content[i].startTime).toGMTString()}`

      content[i].commandAttempts.forEach(attempt => {
        const li = document.createElement('li')
        li.innerHTML = attempt
        li.className = 'history-single-command'
        commandAttempts.appendChild(li)
      })

      duration.className = 'history-duration'

      if (content[i].endTime) {
        const timeToCompleteInSeconds = Math.floor((content[i].endTime - content[i].startTime) / 1000)

        const completionTime = {
          hours: Math.floor(timeToCompleteInSeconds / 3600),
          minutes: Math.floor(timeToCompleteInSeconds / 60),
          seconds: timeToCompleteInSeconds
        }

        duration.innerHTML = `Took ${completionTime.hours} hours, ${completionTime.minutes} minutes, and ${completionTime.seconds} seconds`
      }

      newElement.appendChild(commandAttempts)
      newElement.appendChild(duration)
      historyContainer.appendChild(spacer)
      historyContainer.appendChild(newElement)
    }

    document.querySelector('#history-modal').style.display = 'block'
  } catch (error) {
    console.error(error)
  }
}

function closeHistoryModal () {
  historyModalOpen = false
  document.querySelector('#history-modal').style.display = 'none'
  document.querySelector('#history-content').innerHTML = ''
}

let restartModalOpen = false

function showRestartModal () {
  const restartModal = document.querySelector('#restart-modal')
  document.querySelector('#blur-page').style.display = 'block'
  restartModalOpen = true
  restartModal.style.display = 'block'
}

function closeRestartModal () {
  const restartModal = document.querySelector('#restart-modal')

  if (!restarting) {
    restartModalOpen = false
  }

  safetyCapClose()

  restartModal.style.display = 'none'
}

let restarting = false

async function restartConfirm (hardRestart = false) {
  restarting = true
  const restartingSpinner = document.querySelector('#restarting-spinner')
  restartingSpinner.style.display = 'block'
  closeRestartModal()

  const response = await fetch('http://127.0.0.1:8080/restart', {
    method: 'PUT',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      hardRestart
    })
  })

  if (response.status === 204) {
    window.location = './index.html'
  }
}

let safetyCapRemoved = false

async function safetyCapRestart () {
  if (!safetyCapRemoved) {
    safetyCapRemoved = true
    const hardRestartButton = document.querySelector('#really-broke')
    const safetyCap = document.querySelector('#safety-cap')
    safetyCap.style.backgroundColor = 'red'
    hardRestartButton.style.color = 'white'
    hardRestartButton.style.backgroundColor = 'darkred'
    return
  }

  await restartConfirm(true)
}

function safetyCapClose () {
  if (!safetyCapRemoved) {
    return
  }

  const hardRestartButton = document.querySelector('#really-broke')
  const safetyCap = document.querySelector('#safety-cap')
  safetyCap.style.backgroundColor = 'white'
  hardRestartButton.style.color = 'red'
  hardRestartButton.style.backgroundColor = 'red'

  safetyCapRemoved = false
}

window.onload = async () => {
  fetchNewContent()
}
