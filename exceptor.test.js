const exceptor = require("./exceptor");
const expect = require("chai").expect;
describe("exceptor", ()=>{
   it("test test",(done)=>{
       expect("test").to.equal("test");
       done();
   });
});
