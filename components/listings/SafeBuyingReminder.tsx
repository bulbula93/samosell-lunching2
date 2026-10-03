export default function SafeBuyingReminder() {
  return (
    <aside aria-label="იყიდე უსაფრთხოდ" className="mt-5 rounded-xl border border-accent/25 bg-surface-alt p-4">
      <h3 className="text-base font-black text-brand"><span aria-hidden="true">♡ </span>იყიდე უსაფრთხოდ</h3>
      <ul className="mt-2 space-y-2 text-sm leading-6 text-text-soft">
        <li>ყიდვამდე გადაამოწმე ნივთის მდგომარეობა.</li>
        <li>უცნობ ადამიანს წინასწარ თანხა არ გადაურიცხო. SamoSell ნივთის გადახდას არ ამუშავებს და თანხის დაცვას არ უზრუნველყოფს.</li>
        <li>საეჭვო განცხადება ან მომხმარებელი შეგიძლია ქვემოთ დაარეპორტო.</li>
      </ul>
    </aside>
  )
}
