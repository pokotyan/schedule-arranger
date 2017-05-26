'use strict';
const request = require('supertest');
const app = require('../app');
const passportStub = require('passport-stub');
let User = require('../models/user');
let Schedule = require('../models/schedule');
let Candidate = require('../models/candidate');

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

describe('/schedules', () => {
  before(() => {
    passportStub.install(app);
    passportStub.login({ id: 0, username: 'testuser' });
  });

  after(() => {
    passportStub.logout();
    passportStub.uninstall(app);
  });

  it('予定が作成でき、表示される', (done) => {
    User.upsert({ userId: 0, username: 'testuser' }).then(() => {
      request(app)
        .post('/schedules')
        .send({ scheduleName: 'テスト予定1', memo: 'テストメモ1\r\nテストメモ2', candidates: 'テスト候補1\r\nテスト候補2\r\nテスト候補3' })
        .expect('Location', /schedules/)
        .expect(302)
        .end((err, res) => {
          let createdSchedulePath = res.headers.location;
          request(app)
            .get(createdSchedulePath)
            .expect(/テスト予定1/)  //.expect(/${文字列}/) とかくことで、引数に指定した正規表現の文字列がレスポンスに含まれる場合はテストを成功させ、含まれない場合はテストを失敗させれる
            .expect(/テストメモ1/)
            .expect(/テストメモ2/)
            .expect(/テスト候補1/)
            .expect(/テスト候補2/)
            .expect(/テスト候補3/)
            .expect(200)
            .end((err, res) => {
              // テストで作成したデータを削除
              let scheduleId = createdSchedulePath.split('/schedules/')[1];
              Candidate.findAll({
                where: { scheduleId: scheduleId }
              }).then((candidates) => {
                candidates.forEach((c) => { c.destroy(); });
                Schedule.findById(scheduleId).then((s) => { s.destroy(); });  // findById 関数は、モデルに対応するデータを主キーによって 1 行だけ取得することができる
              });
              if (err) return done(err);
              done();
            });
        });
    });
  });

});
