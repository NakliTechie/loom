import createT4 from "./t4.js";
import { makeNode } from "./node-core.js";
const nd = makeNode(createT4);
self.onmessage = async (e) => { const { reply, transfer } = await nd.call(e.data); postMessage({ id: e.data.id, ...reply }, transfer || []); };
