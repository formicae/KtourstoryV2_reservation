const Log = require("./log");
const chai = require("chai");
const expect = chai.expect;
describe("log", function(){
    it("test",(done)=>{
        let testReturnFunc = ()=>"test";
        expect(testReturnFunc()).to.equal("test");
        expect(()=>{throw new Error()}).to.throw();
        done();
    });
});