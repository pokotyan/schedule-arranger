'use strict';
const $ = require('jquery');
//グローバルオブジェクトの jQuery というプロパティに jQuery を代入。これを行わないと Bootstrap が jQuery を利用できない
const global = Function('return this;')(); //即時関数の実行。Function 関数は、引数で受け取った文字列をもとに関数を生成する
global.jQuery = $;
const bootstrap = require('bootstrap');

//自身の出欠の更新
$('.availability-toggle-button').each((i, e) => {
  const button = $(e);
  button.click(() => {
    const scheduleId = button.data('schedule-id');
    const userId = button.data('user-id');
    const candidateId = button.data('candidate-id');
    const availability = parseInt(button.data('availability'));
    const nextAvailability = (availability + 1) % 3;  //0 → 1 → 2 → 0 → 1 → 2 と循環させたいため、ここでは 1 を足して 3 の剰余を次の出欠の数値としています。
    $.post(`/schedules/${scheduleId}/users/${userId}/candidates/${candidateId}`,
      { availability: nextAvailability },             //webapiに渡す引数
      (data) => {
        //出欠状況のテキストを更新
        button.data('availability', data.availability);
        const availabilityLabels = ['欠', '？', '出'];
        button.text(availabilityLabels[data.availability]);

        //ボタンの色とtdの背景色を出欠の状態によって変更させる
        const buttonStyles = ['btn-danger', 'btn-default', 'btn-success'];
        button.removeClass('btn-danger btn-default btn-success');
        button.addClass(buttonStyles[data.availability]);

        const tdStyles = ['bg-danger', 'bg-default', 'bg-success'];
        button.parent().removeClass('bg-danger bg-default bg-success');     //button.parent()はクリックしたボタンの親要素（つまりtd）
        button.parent().addClass(tdStyles[data.availability]);
      });
  });
});

//自身のコメント編集
const buttonSelfComment = $('#self-comment-button');
buttonSelfComment.click(()=>{
  const scheduleId = buttonSelfComment.data('schedule-id');
  const userId = buttonSelfComment.data('user-id');
  const currentComment = $('#self-comment').text();                            //現在のコメントの内容
  const comment = prompt('コメントを255文字以内で入力してください',currentComment);  //promptで入力ダイアログを表示し、入力値をcommentに格納。ダイアログの初期値は現在のコメント内容
  if (comment) {
    $.post(`/schedules/${scheduleId}/users/${userId}/comments`, //webapi（comments.js）を叩く
      { comment: comment },                                     //引数に入力したコメントを渡す
      (data)=>{
        $('#self-comment').text(data.comment);                  //webapiの返り値でコメント内容を更新
      });
  }
})