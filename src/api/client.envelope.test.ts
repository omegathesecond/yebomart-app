import {afterEach,it,expect,vi} from 'vitest';
vi.mock('@/lib/yeboid',()=>({getAccessToken:vi.fn().mockResolvedValue(null)}));
import api from './client';
afterEach(()=>{vi.unstubAllGlobals();localStorage.clear();});
it('preserves an explicit null resource instead of returning the success envelope as data',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({success:true,data:null}),{status:200,headers:{'Content-Type':'application/json'}})));const response=await api.request('/api/restaurant');expect(response.data).toBeNull();expect(response.error).toBeUndefined();});
