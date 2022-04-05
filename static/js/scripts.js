/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */

async function handleClick (e) {
  try {
    const location = document.querySelector('#contenturl').value
    const response = await fetch('http://127.0.0.1:8080/content', {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ contentUrl: location })
    })

    if (response.status === 200) {
      window.location = './terminal.html'
    }

    // If we get here, we know it's an error
    if (response.status === 404) {
      throw new Error('Could not find content')
    }

    const errorInformation = await response.json()

    if (errorInformation.code === 'ENOTFOUND') {
      throw new Error(`Looks we couldn't find the host http://${location}, full error was ${JSON.stringify(errorInformation)}`)
    }

    if (response.status === 500) {
      throw new Error(JSON.stringify(errorInformation))
    }

    throw new Error('Something inexplicable happened!')
  } catch (error) {
    const errorBox = document.querySelector('#something-went-wrong')
    const details = document.querySelector('#details')
    details.innerHTML = error
    errorBox.style.display = 'block'
  }
}
