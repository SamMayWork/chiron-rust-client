const app = require('./src/app')

app.listen(process.env.PORT || 8008, () => {
  console.log(`Server Established and listening on port ${process.env.PORT}`)
})