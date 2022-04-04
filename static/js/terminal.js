/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */

async function handleCommandInput () {
  const commandInput = document.querySelector('#commandInput')

  const response = await fetch('http://127.0.0.1:8080/command', {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ command: commandInput.value })
  })

  const responseObj = await response.json()
  document.querySelector('#response').innerHTML = responseObj.commandOutput

  if (responseObj.newContent) {
    await fetchNewContent()
  }
}

async function fetchNewContent () {
  const response = await fetch('http://127.0.0.1:8080/htmlcontent', {
    method: 'GET',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  const contentWindow = document.querySelector('.markdown-body')
  contentWindow.innerHTML = await response.text()
}

window.onload = async () => {
  fetchNewContent()
}
