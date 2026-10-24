import { ApiError, api } from './api'

function respond(status: number, body?: unknown) {
  return Promise.resolve(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    }),
  )
}

describe('api', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the parsed JSON body', async () => {
    fetchMock.mockReturnValue(respond(200, { currency: 'BRL', locale: 'pt-BR', partner_name: '' }))

    await expect(api.getSettings()).resolves.toEqual({ currency: 'BRL', locale: 'pt-BR', partner_name: '' })
    expect(fetchMock).toHaveBeenCalledWith('/api/settings', expect.objectContaining({ method: 'GET' }))
  })

  it('sends JSON bodies', async () => {
    fetchMock.mockReturnValue(respond(200, { currency: 'USD', locale: 'en', partner_name: 'Ana' }))

    await api.updateSettings({ locale: 'en' })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('PUT')
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body)).toEqual({ locale: 'en' })
  })

  it('throws an ApiError carrying the status and the server message', async () => {
    fetchMock.mockReturnValue(respond(400, { error: 'currency is invalid' }))

    const error = await api.getSettings().catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 400, message: 'currency is invalid' })
  })

  it('falls back to a generic message when the error body is not JSON', async () => {
    fetchMock.mockReturnValue(Promise.resolve(new Response('<html>bad gateway</html>', { status: 502 })))

    await expect(api.getSettings()).rejects.toMatchObject({ status: 502, message: 'Request failed (502)' })
  })

  it('treats 204 as an empty success', async () => {
    fetchMock.mockReturnValue(respond(204))

    await expect(api.request('DELETE', '/api/transactions/1')).resolves.toBeUndefined()
  })

  it('lets network failures through as-is', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(api.getSettings()).rejects.toThrow('Failed to fetch')
  })
})
