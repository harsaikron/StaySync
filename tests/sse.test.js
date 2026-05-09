const { addClient, removeClient, broadcast, getClientCount } = require('../services/sse');

test('addClient registers a client for a cameraId', () => {
  const mockRes = { write: jest.fn() };
  addClient('cam1', mockRes);
  expect(getClientCount('cam1')).toBe(1);
  removeClient('cam1', mockRes);
});

test('broadcast writes to all clients for cameraId', () => {
  const mockRes1 = { write: jest.fn() };
  const mockRes2 = { write: jest.fn() };
  addClient('cam2', mockRes1);
  addClient('cam2', mockRes2);
  broadcast('cam2', { type: 'guidance', text: 'Take your medicine' });
  expect(mockRes1.write).toHaveBeenCalledWith(
    expect.stringContaining('Take your medicine')
  );
  expect(mockRes2.write).toHaveBeenCalledWith(
    expect.stringContaining('Take your medicine')
  );
  removeClient('cam2', mockRes1);
  removeClient('cam2', mockRes2);
});

test('broadcast does nothing if no clients for cameraId', () => {
  expect(() => broadcast('cam-nobody', { text: 'hi' })).not.toThrow();
});
