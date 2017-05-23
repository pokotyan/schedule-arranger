'use strict';
const request = require('supertest');
const app = require('../app');
const passportStub = require('passport-stub');

describe('/login',()=>{
  //before 関数で記述された処理は describe 内のテスト前に実行されます
  //after 関数で記述された処理は describe 内のテストの後に実行されます。
  //これは mocha の機能で、他にも各 it 内のテストの前後に実行させる処理も記述できます。

  //テストの前に passportStub を app オブジェクトにインストールし、 testuser というユーザー名のユーザーでログインしています。
  before(()=>{
    passportStub.install(app);
    passportStub.login({ username: 'testuser' });
  });
  //テストの後は、ログアウトして、アンインストールする処理を実行しています。
  after(()=>{
    passportStub.logout();
    passportStub.uninstall(app);
  });

  it('ログインのためのリンクが含まれる',(done)=>{
    request(app)
      .get('/login')                                        // /login への GET リクエストを作成します。
      .expect('Content-Type', 'text/html; charset=utf-8')   //文字列を 2 つ引数として渡し、ヘッダにその値が存在するかをテストしています。
      .expect(/<a href="\/auth\/github"/)                   //expect 関数に、正規表現を一つ渡すと、 HTML の body 内にその正規表現が含まれるかをテストします。
      .expect(200, done);                                   //テストを終了する際には、 expect 関数に、期待されるステータスコードの整数と、テスト自体の引数に渡される done 関数を渡します。
  });

  // ログイン後、その HTML の body 内に、 testuser という文字列が含まれることをテストしています。
  it('ログイン時はユーザー名が表示される',(done)=>{
    request(app)
      .get('/login')
      .expect(/testuser/)
      .expect(200, done);
  });

});

describe('/logout',()=>{
  it('/logoutにアクセスすると / にリダイレクトされる',(done)=>{
    request(app)
      .get('/logout')
      .expect('Location', '/')
      .expect(302, done);
  })
});

