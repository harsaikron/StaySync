const clients = new Map();

function addClient(cameraId, res) {
  if (!clients.has(cameraId)) clients.set(cameraId, new Set());
  clients.get(cameraId).add(res);
}

function removeClient(cameraId, res) {
  clients.get(cameraId)?.delete(res);
}

function broadcast(cameraId, data) {
  const group = clients.get(cameraId);
  if (!group || group.size === 0) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of group) res.write(payload);
}

function getClientCount(cameraId) {
  return clients.get(cameraId)?.size ?? 0;
}

module.exports = { addClient, removeClient, broadcast, getClientCount };
