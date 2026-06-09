docs/startup/start-all.sh：默认走快速启动；只有你传 --build 才编译，传 --refresh-cp 才重建依赖 classpath，传 --install-bms-client 才安装 BMS client/model 给 platform-admin。这样不破坏现在的启动监听逻辑。

新的用法：

./docs/startup/start-all.sh bms
./docs/startup/start-all.sh platform-admin
./docs/startup/start-all.sh backend
默认会跳过：

Maven 编译
依赖 classpath 重建
BMS client/model install
需要编译时再加：

./docs/startup/start-all.sh --build bms
改了 bms/model 或 bms/client，platform-admin 需要新依赖时用：

./docs/startup/start-all.sh --install-bms-client platform-admin
彻底全量刷新用：

./docs/startup/start-all.sh --full backend
我已经实测了 ./docs/startup/start-all.sh --fast bms，日志确认跳过编译和 classpath 重建，BMS 启动成功。