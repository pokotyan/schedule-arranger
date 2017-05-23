'use strict';
const request = require('supertest');
const app = require('../app');

describe('/login',()=>{
  it('ログインのためのリンクが含まれる',(done)=>{
    request(app)
      .get('/login')                                        // /login への GET リクエストを作成します。
      .expect('Content-Type', 'text/html; charset=utf-8')   //文字列を 2 つ引数として渡し、ヘッダにその値が存在するかをテストしています。
      .expect(/<a href="\/auth\/github"/)                   //expect 関数に、正規表現を一つ渡すと、 HTML の body 内にその正規表現が含まれるかをテストします。
      .expect(200, done);                                   //テストを終了する際には、 expect 関数に、期待されるステータスコードの整数と、テスト自体の引数に渡される done 関数を渡します。
  });
});