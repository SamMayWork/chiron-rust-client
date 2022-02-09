const supertest = require('supertest')
const { expect } = require('chai')
const app = require('../src/app')

describe('App Tests', () => {
  it('Should return a HTML page when called on the / route', () => {
    supertest(app)
      .get('/')
      .expect(200)
      .then(response => {
        expect(response).to.not.equal(undefined)
      })
  })
})