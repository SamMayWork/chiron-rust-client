const checker = require('../../src/kubeChecker')
const { setTimeout } = require('timers/promises')

const PROMISE_RETURN_DELAY = 50

describe('KubeChecker Tests', () => {
  describe('processChunkConditions', () => {
    it('Should return true when all of the checks have been met', async () => {
      jest.spyOn(checker, 'performCheck').mockImplementation(async () => {
        await setTimeout(PROMISE_RETURN_DELAY)
        return true
      })

      const conditionsMet = await checker.processChunkConditions(['something', 'something'])
      expect(conditionsMet).toBe(true)
    })

    it('Should return false when all of the checks have not been met', async () => {
      jest.spyOn(checker, 'performCheck').mockImplementation(async () => {
        await setTimeout(PROMISE_RETURN_DELAY)
        return false
      })

      const conditionsMet = await checker.processChunkConditions(['something', 'something'])
      expect(conditionsMet).toBe(false)
    })

    it('Should not reject when one of the promises rejects', async () => {
      jest.spyOn(checker, 'performCheck').mockImplementation(async () => {
        await setTimeout(PROMISE_RETURN_DELAY)
        return Promse.reject('BangBangBang!')
      })

      const conditionsMet = await checker.processChunkConditions(['something', 'something'])
      expect(conditionsMet).toBe(undefined)
    })

    it('Should return false when one of the checks has not been met', async () => {
      jest.spyOn(checker, 'performCheck')
        .mockImplementationOnce(async () => {
          await setTimeout(PROMISE_RETURN_DELAY)
          return false
        })
        .mockImplementationOnce(async () => {
          await setTimeout(PROMISE_RETURN_DELAY)
          return true
        })

      const conditionsMet = await checker.processChunkConditions(['something', 'something'])
      expect(conditionsMet).toBe(false)
    })
  })
})