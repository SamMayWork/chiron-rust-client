async function handleClick (e) {
  const location = document.querySelector('#contenturl').value
  const response = await fetch('http://127.0.0.1:8080/content', {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ contentUrl: location })
  })

  console.log(response)
}