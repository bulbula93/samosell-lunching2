import { expect,it } from "vitest"
import { validateListingInput } from "@/lib/listing-form"
const input={title:"ტყავის ქურთუკი",description:"კარგ მდგომარეობაშია და დეფექტი არ აქვს.",price:"120.50",categoryId:1,brandId:"",sizeId:"",condition:"good",saleType:"gift",gender:"unisex",color:"შავი",material:"ტყავი",city:"თბილისი",sellerPhone:"+995 555 12 34 56",publishNow:true}
it("normalizes gifts to zero even if the old sale price remains",()=>{
 const result=validateListingInput(input)
 expect(result.ok).toBe(true)
 if(result.ok){expect(result.data.price).toBe("0.00");expect(result.data.saleType).toBe("gift")}
})
it("accepts empty gift price but rejects an empty sale price",()=>{
 expect(validateListingInput({...input,price:""}).ok).toBe(true)
 expect(validateListingInput({...input,price:"",saleType:"sell"}).ok).toBe(false)
})
