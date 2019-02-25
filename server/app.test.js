const supertest = require("supertest");
const chai = require("chai");
const expect = chai.expect;
const app = require("./app");
const validation = require('./models/validation');
describe("app", ()=>{

    it("returns 404", (done)=>{
        supertest(app).get("/").expect(404).expect((res)=>{
            let parsed = JSON.parse(res.text);
            expect(parsed.msg).to.be.a("string");
        }).end(done);
    });

    it("returns mail id", (done)=>{
        let mail = {id:"123123"};
        supertest(app)
            .post("/reservation")
            .send(mail)
            .expect(200)
            .expect("content-type", "application/json; charset=utf-8")
            .expect((res)=>{
                expect(JSON.parse(res.text).mail).to.equal(mail.id);
            })
            .end(done);
    });
});