// /js/domain/id.js
// DEPRECATED: используйте js/infra/deviceId.js
export const DeviceId = {
  get() { try { return require("../infra/deviceId.js").get(); } catch { return "0"; } }
};
