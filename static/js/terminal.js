window.onload = async () => {
  const response = await fetch('http://127.0.0.1:8080/htmlcontent', {
    method: 'GET',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  const contentWindow = document.querySelector('#pageContent')
  contentWindow.innerHTML = await response.text()
}

async function handleCommandInput () {
  const commandInput = document.querySelector('#commandInput')

  const response = await fetch('http://127.0.0.1:8080/command', {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ "command":commandInput.value })
  })

  document.querySelector('#response').innerHTML = await response.text()
}