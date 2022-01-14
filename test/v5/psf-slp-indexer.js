/*
  TESTS FOR THE PSF-SLP-INDEXER.JS LIBRARY
*/

'use strict'

const chai = require('chai')
const assert = chai.assert
const PsfSlpIndexerRouter = require('../../src/routes/v5/psf-slp-indexer')
const uut = new PsfSlpIndexerRouter()

// const nock = require('nock') // HTTP mocking
const sinon = require('sinon')
let originalEnvVars // Used during transition from integration to unit tests.

// Mocking data.
const { mockReq, mockRes } = require('./mocks/express-mocks')
const mockData = require('./mocks/psf-slp-indexer-mocks')

// Used for debugging.
const util = require('util')
util.inspect.defaultOptions = { depth: 1 }

describe('#PsfSlpIndexer', () => {
  let req, res
  let sandbox
  before(() => {
    // Save existing environment variables.
    originalEnvVars = {
      BITCOINCOM_BASEURL: process.env.BITCOINCOM_BASEURL,
      RPC_BASEURL: process.env.RPC_BASEURL,
      RPC_USERNAME: process.env.RPC_USERNAME,
      RPC_PASSWORD: process.env.RPC_PASSWORD
    }

    // Set default environment variables for unit tests.
    if (!process.env.TEST) process.env.TEST = 'unit'
    if (process.env.TEST === 'unit') {
      process.env.BITCOINCOM_BASEURL = 'http://fakeurl/api/'
      process.env.RPC_BASEURL = 'http://fakeurl/api'
      process.env.RPC_USERNAME = 'fakeusername'
      process.env.RPC_PASSWORD = 'fakepassword'
    }
  })

  // Setup the mocks before each test.
  beforeEach(() => {
    // Mock the req and res objects used by Express routes.
    req = mockReq
    res = mockRes

    // Explicitly reset the parmas and body.
    req.params = {}
    req.body = {}
    req.query = {}

    sandbox = sinon.createSandbox()
  })

  afterEach(() => {
    // Restore Sandbox
    sandbox.restore()
  })

  after(() => {
    // Restore any pre-existing environment variables.
    process.env.BITCOINCOM_BASEURL = originalEnvVars.BITCOINCOM_BASEURL
    process.env.RPC_BASEURL = originalEnvVars.RPC_BASEURL
    process.env.RPC_USERNAME = originalEnvVars.RPC_USERNAME
    process.env.RPC_PASSWORD = originalEnvVars.RPC_PASSWORD
  })

  describe('#root', async () => {
    // root route handler.
    it('should respond to GET for base route', async () => {
      const result = uut.root(req, res)
      // console.log(`result: ${util.inspect(result)}`)

      assert.equal(result.status, 'psf-slp-indexer', 'Returns static string')
    })
  })

  describe('#getTokenStats', async () => {
    it('should throw 400 error if tokenId  is missing', async () => {
      const result = await uut.getTokenStats(req, res)
      // console.log(`result: ${util.inspect(result)}`)

      assert.hasAllKeys(result, ['error', 'success'])
      assert.isFalse(result.success)
      assert.include(result.error, 'tokenId can not be empty')
    })

    it('should throw 503 when network issues', async () => {
      req.body.tokenId =
        'a4fb5c2da1aa064e25018a43f9165040071d9e984ba190c222a7f59053af84b2'

      // Save the existing RPC URL.
      const savedUrl2 = process.env.RPC_BASEURL

      // Manipulate the URL to cause a 500 network error.
      process.env.RPC_BASEURL = 'http://fakeurl/api/'

      await uut.getTokenStats(req, res)
      // console.log(`result: ${util.inspect(result)}`)

      // Restore the saved URL.
      process.env.RPC_BASEURL = savedUrl2

      assert.isAbove(
        res.statusCode,
        499,
        'HTTP status code 500 or greater expected.'
      )
      // assert.include(result.error,"Network error: Could not communicate with full node","Error message expected")
    })
    it('returns proper error when downstream service stalls', async () => {
      req.body.tokenId =
        'a4fb5c2da1aa064e25018a43f9165040071d9e984ba190c222a7f59053af84b2'

      // Mock the timeout error.
      sandbox.stub(uut.axios, 'post').throws({ code: 'ECONNABORTED' })

      const result = await uut.getTokenStats(req, res)
      // console.log(`result: ${JSON.stringify(result, null, 2)}`)

      assert.isAbove(res.statusCode, 499, 'HTTP status code 503 expected.')
      assert.include(
        result.error,
        'Could not communicate with full node',
        'Error message expected'
      )
    })

    it('returns proper error when downstream service is down', async () => {
      req.body.tokenId =
        'a4fb5c2da1aa064e25018a43f9165040071d9e984ba190c222a7f59053af84b2'

      // Mock the timeout error.
      sandbox.stub(uut.axios, 'post').throws({ code: 'ECONNREFUSED' })

      const result = await uut.getTokenStats(req, res)
      // console.log(`result: ${JSON.stringify(result, null, 2)}`)

      assert.isAbove(res.statusCode, 499, 'HTTP status code 503 expected.')
      assert.include(
        result.error,
        'Could not communicate with full node',
        'Error message expected'
      )
    })

    it('should GET tokens stats', async function () {
      req.body.tokenId =
        'a4fb5c2da1aa064e25018a43f9165040071d9e984ba190c222a7f59053af84b2'
      // Mock the RPC call for unit tests.
      if (process.env.TEST === 'unit') {
        sandbox
          .stub(uut.axios, 'post')
          .resolves({ data: mockData.tokenStats })
      } else {
        return this.skip()
      }

      const result = await uut.getTokenStats(req, res)
      const tokenData = result.tokenData
      assert.property(tokenData, 'type')
      assert.property(tokenData, 'ticker')
      assert.property(tokenData, 'name')
      assert.property(tokenData, 'tokenId')
      assert.property(tokenData, 'documentUri')
      assert.property(tokenData, 'documentHash')
      assert.property(tokenData, 'decimals')
      assert.property(tokenData, 'mintBatonIsActive')
      assert.property(tokenData, 'tokensInCirculationBN')
      assert.property(tokenData, 'tokensInCirculationStr')
      assert.property(tokenData, 'blockCreated')
      assert.property(tokenData, 'totalBurned')
      assert.property(tokenData, 'totalMinted')
      assert.property(tokenData, 'txs')
    })
  })

  describe('#getTxid', async () => {
    it('should throw 400 error if txid  is missing', async () => {
      const result = await uut.getTxid(req, res)
      // console.log(`result: ${util.inspect(result)}`)

      assert.hasAllKeys(result, ['error', 'success'])
      assert.isFalse(result.success)
      assert.include(result.error, 'txid can not be empty')
    })
    it('should throw 400 error if txid  is invalid format', async () => {
      req.body.txid = 'txid'

      const result = await uut.getTxid(req, res)
      // console.log(`result: ${util.inspect(result)}`)

      assert.hasAllKeys(result, ['error', 'success'])
      assert.isFalse(result.success)
      assert.include(result.error, 'This is not a txid')
    })
    it('should throw 503 when network issues', async () => {
      req.body.txid =
        'f3e14cd871402a766e85045dc552f2c1e87857dd3ea1b15efab6334ccef5e315'

      // Save the existing RPC URL.
      const savedUrl2 = process.env.RPC_BASEURL

      // Manipulate the URL to cause a 500 network error.
      process.env.RPC_BASEURL = 'http://fakeurl/api/'

      await uut.getTxid(req, res)
      // console.log(`result: ${util.inspect(result)}`)

      // Restore the saved URL.
      process.env.RPC_BASEURL = savedUrl2

      assert.isAbove(
        res.statusCode,
        499,
        'HTTP status code 500 or greater expected.'
      )
      // assert.include(result.error,"Network error: Could not communicate with full node","Error message expected")
    })
    it('returns proper error when downstream service stalls', async () => {
      req.body.txid =
        'f3e14cd871402a766e85045dc552f2c1e87857dd3ea1b15efab6334ccef5e315'

      // Mock the timeout error.
      sandbox.stub(uut.axios, 'post').throws({ code: 'ECONNABORTED' })

      const result = await uut.getTxid(req, res)
      // console.log(`result: ${JSON.stringify(result, null, 2)}`)

      assert.isAbove(res.statusCode, 499, 'HTTP status code 503 expected.')
      assert.include(
        result.error,
        'Could not communicate with full node',
        'Error message expected'
      )
    })

    it('returns proper error when downstream service is down', async () => {
      req.body.txid =
        'f3e14cd871402a766e85045dc552f2c1e87857dd3ea1b15efab6334ccef5e315'

      // Mock the timeout error.
      sandbox.stub(uut.axios, 'post').throws({ code: 'ECONNREFUSED' })

      const result = await uut.getTxid(req, res)
      // console.log(`result: ${JSON.stringify(result, null, 2)}`)

      assert.isAbove(res.statusCode, 499, 'HTTP status code 503 expected.')
      assert.include(
        result.error,
        'Could not communicate with full node',
        'Error message expected'
      )
    })

    it('should GET tx data', async function () {
      req.body.txid =
        'f3e14cd871402a766e85045dc552f2c1e87857dd3ea1b15efab6334ccef5e315'
      // Mock the RPC call for unit tests.
      if (process.env.TEST === 'unit') {
        sandbox
          .stub(uut.axios, 'post')
          .resolves({ data: mockData.txData })
      } else {
        return this.skip()
      }

      const result = await uut.getTxid(req, res)
      const txData = result.txData
      assert.property(txData, 'txid')
      assert.property(txData, 'hash')
      assert.property(txData, 'version')
      assert.property(txData, 'size')
      assert.property(txData, 'locktime')
      assert.property(txData, 'vin')
      assert.property(txData, 'vout')
      assert.property(txData, 'hex')
      assert.property(txData, 'blockhash')
      assert.property(txData, 'confirmations')
      assert.property(txData, 'time')
      assert.property(txData, 'blocktime')
      assert.property(txData, 'blockheight')
      assert.property(txData, 'isSlpTx')
      assert.property(txData, 'tokenTxType')
      assert.property(txData, 'tokenId')
      assert.property(txData, 'tokenType')
      assert.property(txData, 'tokenTicker')
      assert.property(txData, 'tokenName')
      assert.property(txData, 'tokenDecimals')
      assert.property(txData, 'tokenUri')
      assert.property(txData, 'tokenDocHash')
      assert.property(txData, 'isValidSlp')
    })
  })

  describe('#getAddress', async () => {
    it('should throw 400 error if address  is missing', async () => {
      const result = await uut.getAddress(req, res)
      // console.log(`result: ${util.inspect(result)}`)

      assert.hasAllKeys(result, ['error', 'success'])
      assert.isFalse(result.success)
      assert.include(result.error, 'address can not be empty')
    })
    it('should throw 400 error if address is invalid format', async () => {
      req.body.address = 'address'

      const result = await uut.getAddress(req, res)
      // console.log(`result: ${util.inspect(result)}`)

      assert.hasAllKeys(result, ['error', 'success'])
      assert.isFalse(result.success)
      assert.include(result.error, 'Invalid BCH address. Double check your address is valid')
    })
    it('should throw 400 error for invalid network address', async () => {
      req.body.address = 'bchtest:qq89kjkeqz9mngp8kl3dpmu43y2wztdjqu500gn4c4'

      const result = await uut.getAddress(req, res)
      // console.log(`result: ${util.inspect(result)}`)

      assert.hasAllKeys(result, ['error', 'success'])
      assert.isFalse(result.success)
      assert.include(result.error, 'Invalid network. Trying to use a testnet address on mainnet, or vice versa.')
    })

    it('should throw 503 when network issues', async () => {
      req.body.address = 'bitcoincash:qzmd5vxgh9m22m6fgvm57yd6kjnjl9qnwywsf3583n'

      // Save the existing RPC URL.
      const savedUrl2 = process.env.RPC_BASEURL

      // Manipulate the URL to cause a 500 network error.
      process.env.RPC_BASEURL = 'http://fakeurl/api/'

      await uut.getAddress(req, res)
      // console.log(`result: ${util.inspect(result)}`)

      // Restore the saved URL.
      process.env.RPC_BASEURL = savedUrl2
      assert.isAbove(
        res.statusCode,
        499,
        'HTTP status code 500 or greater expected.'
      )
      // assert.include(result.error,"Network error: Could not communicate with full node","Error message expected")
    })
    it('returns proper error when downstream service stalls', async () => {
      req.body.address = 'bitcoincash:qzmd5vxgh9m22m6fgvm57yd6kjnjl9qnwywsf3583n'

      // Mock the timeout error.
      sandbox.stub(uut.axios, 'post').throws({ code: 'ECONNABORTED' })

      const result = await uut.getAddress(req, res)
      // console.log(`result: ${JSON.stringify(result, null, 2)}`)

      assert.isAbove(res.statusCode, 499, 'HTTP status code 503 expected.')
      assert.include(
        result.error,
        'Could not communicate with full node',
        'Error message expected'
      )
    })

    it('returns proper error when downstream service is down', async () => {
      req.body.address = 'bitcoincash:qzmd5vxgh9m22m6fgvm57yd6kjnjl9qnwywsf3583n'

      // Mock the timeout error.
      sandbox.stub(uut.axios, 'post').throws({ code: 'ECONNREFUSED' })

      const result = await uut.getAddress(req, res)
      // console.log(`result: ${JSON.stringify(result, null, 2)}`)

      assert.isAbove(res.statusCode, 499, 'HTTP status code 503 expected.')
      assert.include(
        result.error,
        'Could not communicate with full node',
        'Error message expected'
      )
    })

    it('should GET address data', async function () {
      req.body.address = 'bitcoincash:qzmd5vxgh9m22m6fgvm57yd6kjnjl9qnwywsf3583n'

      // Mock the RPC call for unit tests.
      if (process.env.TEST === 'unit') {
        sandbox
          .stub(uut.axios, 'post')
          .resolves({ data: mockData.balance })
      } else {
        return this.skip()
      }

      const result = await uut.getAddress(req, res)
      const balance = result.balance
      assert.property(balance, 'utxos')
      assert.property(balance, 'txs')
      assert.property(balance, 'balances')
      assert.isArray(balance.utxos)
      assert.isArray(balance.txs)
      assert.isArray(balance.balances)
    })
  })

  describe('#getStatus', async () => {
    it('should throw 503 when network issues', async () => {
      // Save the existing RPC URL.
      const savedUrl2 = process.env.RPC_BASEURL

      // Manipulate the URL to cause a 500 network error.
      process.env.RPC_BASEURL = 'http://fakeurl/api/'

      await uut.getStatus(req, res)
      // console.log(`result: ${util.inspect(result)}`)

      // Restore the saved URL.
      process.env.RPC_BASEURL = savedUrl2
      assert.isAbove(
        res.statusCode,
        499,
        'HTTP status code 500 or greater expected.'
      )
      // assert.include(result.error,"Network error: Could not communicate with full node","Error message expected")
    })
    it('returns proper error when downstream service stalls', async () => {
      // Mock the timeout error.
      sandbox.stub(uut.axios, 'get').throws({ code: 'ECONNABORTED' })

      const result = await uut.getStatus(req, res)
      // console.log(`result: ${JSON.stringify(result, null, 2)}`)

      assert.isAbove(res.statusCode, 499, 'HTTP status code 503 expected.')
      assert.include(
        result.error,
        'Could not communicate with full node',
        'Error message expected'
      )
    })

    it('returns proper error when downstream service is down', async () => {
      // Mock the timeout error.
      sandbox.stub(uut.axios, 'get').throws({ code: 'ECONNREFUSED' })

      const result = await uut.getStatus(req, res)
      // console.log(`result: ${JSON.stringify(result, null, 2)}`)

      assert.isAbove(res.statusCode, 499, 'HTTP status code 503 expected.')
      assert.include(
        result.error,
        'Could not communicate with full node',
        'Error message expected'
      )
    })

    it('should GET indexer status', async function () {
      // Mock the RPC call for unit tests.
      if (process.env.TEST === 'unit') {
        sandbox
          .stub(uut.axios, 'get')
          .resolves({ data: mockData.status })
      } else {
        return this.skip()
      }

      const result = await uut.getStatus(req, res)
      const status = result.status
      assert.property(status, 'startBlockHeight')
      assert.property(status, 'syncedBlockHeight')
      assert.property(status, 'chainBlockHeight')
    })
  })
  describe('#errorHandler', () => {
    it('should handle unexpected errors', () => {
      sandbox.stub(uut.routeUtils, 'decodeError').returns({ msg: false })

      const result = uut.errorHandler(new Error('test error'), res)
      // console.log('result: ', result)
      assert.equal(res.statusCode, 400, 'HTTP status code 400 expected.')
      assert.property(result, 'error')
    })
    it('should handle unknow errors', () => {
      sandbox.stub(uut.routeUtils, 'decodeError').returns({ msg: false })

      const result = uut.errorHandler({}, res)
      // console.log('result: ', result)
      assert.equal(res.statusCode, 500, 'HTTP status code 500 expected.')
      assert.property(result, 'error')
    })
  })
  describe('#checkEnvVar', () => {
    it('should throw errors if SLP_INDEXER_API env var is not provided', () => {
      const savedSlpIndexerUrl = process.env.SLP_INDEXER_API
      try {
        process.env.SLP_INDEXER_API = ''
        uut.checkEnvVar()
        assert.fail('unexpected code path')
      } catch (error) {
        assert.include(
          error.message,
          'SLP_INDEXER_API env var not set. Can not connect to PSF SLP indexer.',
          'Error message expected'
        )
      }
      process.env.SLP_INDEXER_API = savedSlpIndexerUrl
    })
  })
})
