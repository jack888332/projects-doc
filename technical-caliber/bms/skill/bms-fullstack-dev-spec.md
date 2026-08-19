# BMS 全栈开发规范

> 本规范以应收账单（ArBill）模块为参考范例，贯穿 Controller → Service → Mapper → SQL 全链路，梳理 BMS 系统的开发约定。

---

## 1 技术栈

| 层级 | 技术 | 版本 / 说明 |
|------|------|-------------|
| 语言 | Java | 8 (1.8) |
| 框架 | Spring Boot | 由 `supplychain-parent:0.0.1-SNAPSHOT` 管理 |
| 微服务 | Spring Cloud | Greenwich.SR3 |
| 注册中心 | Eureka | `eureka-server:8890` |
| 配置中心 | Disconf | `disconf.enabled: true` |
| ORM | MyBatis | mybatis-spring-boot-starter 2.1.4 |
| 数据库 | MySQL | 8.x (connector 8.0.33) |
| 连接池 | HikariCP | Spring Boot 默认 |
| 服务调用 | Spring Cloud OpenFeign | OkHttp 客户端 |
| 负载均衡 | Ribbon | 自定义 `RibbonConfig` |
| 熔断 | Hystrix | 超时 60s |
| 构建工具 | Maven | profile: dev / local / test / prod |
| 容器化 | Docker | 基础镜像 `192.168.0.242:5000/app-starter:latest` |
| 模型注解 | Lombok | 1.18.32 |

---

## 2 项目结构

### 2.1 六模块分层

```
bms/
├── pom.xml                   # 父 POM，管理 modules 和公共依赖版本
├── common/                   # supplychain-bms-service-common
│   └── src/main/java/.../constant/BmsConstants.java
├── model/                    # supplychain-bms-service-model
│   └── src/main/java/.../model/
│       ├── ArBill.java              # 实体类（1表1类）
│       ├── dto/                     # DTO 类（请求 / 响应 / 传输）
│       ├── entity/                  # JPA/MyBatis 辅助实体
│       ├── enums/                   # 枚举定义
│       └── profile/                 # 嵌入式/组合对象
├── dao/                      # supplychain-bms-service-dao
│   └── src/main/java/.../dao/
│       ├── mapper/                  # MyBatis Mapper 接口（纯方法声明，不含 SQL）
│       └── conf/MapperConfFactory.java
│   └── src/main/resources/sqlmap/   # XML Mapper（所有 SQL 均在此定义）
├── biz/                      # supplychain-bms-service-biz
│   └── src/main/java/.../biz/
│       ├── service/                 # Service 接口
│       │   └── ArBillService.java
│       ├── service/impl/            # Service 实现
│       │   └── ArBillServiceImpl.java
│       └── task/                    # 定时任务
├── client/                   # supplychain-bms-service-client
│   └── src/main/java/.../client/api/
│       └── ArBillRemoteService.java  # Feign 远程调用契约
└── web/                      # supplychain-bms-service-web
    └── src/main/java/.../web/
        ├── BmsStarter.java          # Spring Boot 启动类
        ├── controller/              # REST Controller
        │   └── ArBillController.java
        ├── config/                  # 配置类
        └── util/                    # 工具类
```

### 2.2 依赖方向

```
common ← model ← dao ← biz ← web
                          ↑
                     client (独立，被其他服务消费)
```

**规则**：
- `common` 不能依赖任何业务模块
- `model` 只依赖 `common`
- `dao` 依赖 `model`（和框架 mybatis）
- `biz` 依赖 `model`、`common`、`dao`、外部 client
- `web` 依赖 `biz`、`dao`、`client`、`model`、`common`
- `client` 只依赖 `model` 和 Feign，保持轻量可被其他服务引用

---

## 3 代码风格

### 3.1 命名规范

| 类别 | 规则 | 示例 |
|------|------|------|
| 实体类 | UpperCamelCase，与表名对应 | `ArBill` → 表 `ar_bill` |
| DTO - 请求 | `XxxReqDTO` / `XxxQueryReqDTO` / `XxxSaveDTO` | `ArBillQueryReqDTO` |
| DTO - 响应 | `XxxRespDTO` / `XxxDTO`（通用传输） | `ArBillPageRespDTO`, `ArBillDTO` |
| 枚举 | `XxxEnum`，字段 `code` + `desc` | `BillConfigTypeEnum` |
| Service 接口 | `XxxService` | `ArBillService` |
| Service 实现 | `XxxServiceImpl` | `ArBillServiceImpl` |
| Controller | `XxxController` | `ArBillController` |
| Feign Client | `XxxRemoteService` | `ArBillRemoteService` |
| Mapper | `XxxMapper` | `ArBillMapper` |

### 3.2 注解风格

实体类和 DTO 的字段注释必须使用标准多行 JavaDoc，注释内容单独占行；禁止使用 `/** 注释 */` 单行写法。

```java
// 实体类：使用 @Data
@Data
public class ArBill {
    /**
     * 账单ID
     */
    private Long id;

    /**
     * 供应链ID
     */
    private Long scId;
    // ...
}

// DTO 类：使用 @Data，字段必须有 JavaDoc 注释
@Data
public class ArBillQueryReqDTO {
    /**
     * 页码，从 1 开始
     */
    private Integer pageNo = 1;

    /**
     * 每页条数
     */
    private Integer pageSize = 20;
    // ...
}
```

### 3.3 业务异常规范

后端业务校验或业务处理失败时，统一抛出 `com.szt.framework.core.exceptions.BusinessException`，由全局异常处理转换为统一响应；禁止用 `IllegalArgumentException` 表达业务规则错误。

完整示例（Service 实现类）：

```java
package com.szt.supplychain.bms.biz.service.impl;

import com.szt.framework.core.exceptions.BusinessException;
import com.szt.supplychain.bms.model.dto.BillConfigSaveReqDTO;
import org.springframework.stereotype.Service;

/**
 * 账单配置业务实现示例。
 */
@Service
public class BillConfigServiceImpl {

    /**
     * 校验默认账单配置。
     *
     * @param reqDTO 保存账单配置的请求
     * @throws BusinessException 默认账单配置为空时抛出
     */
    private void validateDefaultConfig(BillConfigSaveReqDTO reqDTO) {
        // 默认账单配置缺失时直接中断，避免后续按空配置生成账单。
        if (reqDTO == null || reqDTO.getDefaultConfig() == null) {
            throw new BusinessException("500", "默认账单配置不能为空");
        }
    }
}
```

### 3.4 代码注释规范

#### 3.4.1 JavaDoc 文档注释

类、接口、方法、字段和 DTO 辅助方法使用标准多行 JavaDoc，见 3.2 节；方法注释必须包含用途、`@param`（如有入参）和 `@return`（如有返回值）。

#### 3.4.2 核心业务逻辑行内注释

核心业务逻辑必须使用 `//` 行内注释说明关键行/关键分支的处理目的，注释要求简单明了：

- 注释写在被解释代码行的上方，说明"这行代码做了什么、为什么这样做"
- 一句话讲清目的，禁止复述代码本身（如 `// 获取列表`、`// 设置状态`）
- 禁止使用 `// 第一步`、`// 第二步` 等无业务含义的步骤编号
- 注释必须随代码同步更新，代码逻辑改变时注释未更新视为未完成
- `getter/setter`、日志输出等无需逐行注释

```java
@Override
@Transactional(rollbackFor = Exception.class)
public Boolean confirm(ArBillActionReqDTO reqDTO) {
    // 校验入参，避免空账单编号进入后续流程。
    if (reqDTO == null || !hasText(reqDTO.getBillNo())) {
        throw new BusinessException("500", "账单编号不能为空");
    }

    // 先加行锁查询账单，防止并发重复确认。
    ArBill bill = arBillMapper.selectByBillNoForUpdate(reqDTO.getBillNo());
    if (bill == null) {
        throw new BusinessException("404", "账单不存在：" + reqDTO.getBillNo());
    }

    // 仅已生成状态的账单允许确认，避免状态回退。
    if (!"GENERATED".equals(bill.getBillStatus())) {
        throw new BusinessException("500", "当前状态不允许确认：" + bill.getBillStatus());
    }

    // 更新账单状态并记录操作人，完成确认。
    return arBillMapper.updateStatusByBillNo(bill.getBillNo(), "CONFIRMED", reqDTO.getOperator()) > 0;
}
```

### 3.5 Controller 风格

```java
/**
 * 应收账单管理
 */
@RestController
@RequestMapping("/api/bms/ar-bill")
public class ArBillController implements ArBillRemoteService {

    @Resource
    private ArBillService arBillService;

    /**
     * 分页查询应收账单。
     *
     * @param reqDTO 查询条件
     * @return 应收账单分页数据
     */
    @Override
    @PostMapping("/page")
    public ArBillPageRespDTO page(@RequestBody(required = false) ArBillQueryReqDTO reqDTO) {
        return arBillService.page(reqDTO);
    }
    // ...
}
```

**要点**：
- Controller 实现 `ArBillRemoteService`（Feign 契约接口），保证内外 API 签名一致
- 使用 `@Resource` 注入（不用 `@Autowired`）
- Controller 只做转发，不含业务逻辑
- 每个方法加 `@Override`
- 每个 API 方法上方必须有完整 JavaDoc，至少说明接口用途、`@param` 入参含义和 `@return` 返回内容；无返回值接口也必须说明接口用途和入参含义
- 写操作必须加 `@PostMapping`（POST），读操作可加 `@GetMapping`（GET）

### 3.6 Service 风格

```java
/**
 * 应收账单业务处理类
 */
public interface ArBillService {

    /**
     * 分页查询应收账单
     * @param query 查询条件
     * @return 分页数据
     */
    ArBillPageRespDTO page(ArBillQueryReqDTO query);
}

@Service
public class ArBillServiceImpl implements ArBillService {

    @Resource
    private ArBillMapper arBillMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean confirm(ArBillActionReqDTO reqDTO) {
        // ...
    }
}
```

**要点**：
- 所有写操作（save / update / delete / confirm / send）必须加 `@Transactional(rollbackFor = Exception.class)`
- 不能只写 `@Transactional`（不指定 rollbackFor 时只回滚 RuntimeException）
- Service 接口的每个方法必须有 JavaDoc
- 空值防御：入参为 null 时创建默认值对象，`ArBillQueryReqDTO safeQuery = query == null ? new ArBillQueryReqDTO() : query;`

### 3.7 Mapper 风格（Mapper 接口 + XML）

BMS 项目 Mapper 层采用 **Mapper 接口 + XML** 的规范写法，SQL 全部写在 XML 中，Mapper 接口只做方法声明。

#### 3.7.1 为什么不用 SqlProvider / 注解 SQL

| 维度 | SqlProvider / 注解 | Mapper + XML |
|------|--------------------|--------------|
| 可读性 | Java 字符串拼接，无语法高亮 | XML 结构清晰，IDE 格式化支持 |
| 可维护性 | SQL 散落在 Java 类中，改条件需重新编译 | 改 SQL 只需修改 XML，热部署友好 |
| 动态条件 | Java `if/append` 拼串，易出错 | `<if>` `<foreach>` 标签，MyBatis 原生支持 |
| 复用性 | `baseColumns()` `whereSql()` 靠内部类方法复用 | `<sql>` 片段可跨语句复用，`<include>` 引用 |
| 调试 | SQL 不便直接复制到 Navicat 执行 | XML 中 SQL 可直接复制执行 |
| 团队协作 | Java 和 SQL 混编，merge 冲突多 | Java 接口和 XML 分离，减少冲突 |

#### 3.7.2 规范写法示例

**Mapper 接口** — 只声明方法，不含任何 SQL；每个方法必须使用标准多行 JavaDoc，说明用途、`@param` 参数含义与 `@return` 返回内容：

```java
@Mapper
public interface ArBillMapper {

    /**
     * 新增应收账单。
     *
     * @param arBill 应收账单实体
     * @return 受影响的记录数
     */
    int insert(ArBill arBill);

    /**
     * 根据账单编号查询应收账单。
     *
     * @param billNo 账单编号
     * @return 应收账单；不存在时返回 {@code null}
     */
    ArBill selectByBillNo(@Param("billNo") String billNo);

    /**
     * 根据账单编号查询应收账单并加行锁。
     *
     * @param billNo 账单编号
     * @return 已锁定的应收账单；不存在时返回 {@code null}
     */
    ArBill selectByBillNoForUpdate(@Param("billNo") String billNo);

    /**
     * 按查询条件统计应收账单数量。
     *
     * @param query 查询条件
     * @return 应收账单数量
     */
    Long countByCondition(ArBillQueryReqDTO query);

    /**
     * 按查询条件分页查询应收账单。
     *
     * @param query 查询条件及分页参数
     * @return 当前页的应收账单列表
     */
    List<ArBill> selectPageByCondition(ArBillQueryReqDTO query);

    /**
     * 按查询条件汇总应收账单数据。
     *
     * @param query 查询条件
     * @return 应收账单汇总数据
     */
    ArBillPageRespDTO selectSummaryByCondition(ArBillQueryReqDTO query);

    /**
     * 根据账单编号更新账单状态。
     *
     * @param billNo 账单编号
     * @param status 目标账单状态
     * @param operator 操作人
     * @return 受影响的记录数
     */
    int updateStatusByBillNo(@Param("billNo") String billNo,
                             @Param("status") String status,
                             @Param("operator") String operator);
}
```

**XML Mapper** — `sqlmap/ArBill-mapper.xml`：

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
        "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.szt.supplychain.bms.dao.mapper.ArBillMapper">

    <!-- 可复用的列片段 -->
    <sql id="BaseColumnList">
        id, bill_no, bill_title, bill_status, bill_config_id, config_type,
        generate_task_id, sc_id, shop_id, user_id, member_code, member_name,
        customer_no, customer_name, destination_country, consolidation_warehouse_code,
        billing_cycle_type, billing_period_start_date, billing_period_end_date,
        bill_send_date, credit_period_end_date, payment_overdue_days,
        bill_currency, fin_currency,
        initial_receivable_amount, this_adjustment_delta_amount,
        previous_adjustment_delta_amount, late_fee_amount,
        receivable_amount, paid_amount, unpaid_amount,
        receivable_amount_fin, paid_amount_fin,
        created_at, updated_at
    </sql>

    <!-- 可复用的 WHERE 片段（含数据隔离三字段） -->
    <sql id="QueryWhere">
        WHERE is_deleted = 0
        <if test="scId != null">AND sc_id = #{scId}</if>
        <if test="shopId != null">AND shop_id = #{shopId}</if>
        <if test="userId != null">AND user_id = #{userId}</if>
        <if test="billNo != null and billNo != ''">
            AND bill_no LIKE CONCAT('%', #{billNo}, '%')
        </if>
        <if test="billStatus != null and billStatus != '' and billStatus != 'all'">
            AND bill_status = #{billStatus}
        </if>
        <if test="overdueOnly != null and overdueOnly">
            AND payment_overdue_days &gt; 0 AND bill_status != 'PAID'
        </if>
        <if test="customerName != null and customerName != ''">
            AND (customer_name LIKE CONCAT('%', #{customerName}, '%')
                OR member_name LIKE CONCAT('%', #{customerName}, '%'))
        </if>
        <if test="memberCode != null and memberCode != ''">
            AND member_code = #{memberCode}
        </if>
        <if test="destinationCountry != null and destinationCountry != ''">
            AND destination_country = #{destinationCountry}
        </if>
        <if test="billingCycleType != null and billingCycleType != ''">
            AND billing_cycle_type = #{billingCycleType}
        </if>
        <if test="periodStartDate != null">
            AND billing_period_end_date &gt;= #{periodStartDate}
        </if>
        <if test="periodEndDate != null">
            AND billing_period_start_date &lt;= #{periodEndDate}
        </if>
    </sql>

    <!-- 结果映射 -->
    <resultMap id="BaseResultMap" type="com.szt.supplychain.bms.model.ArBill">
        <id column="id" property="id"/>
        <result column="bill_no" property="billNo"/>
        <result column="bill_title" property="billTitle"/>
        <result column="bill_status" property="billStatus"/>
        <result column="bill_config_id" property="billConfigId"/>
        <result column="config_type" property="configType"/>
        <result column="sc_id" property="scId"/>
        <result column="shop_id" property="shopId"/>
        <result column="user_id" property="userId"/>
        <result column="member_code" property="memberCode"/>
        <result column="member_name" property="memberName"/>
        <result column="receivable_amount" property="receivableAmountInBillCurrency"/>
        <result column="paid_amount" property="paidAmountInBillCurrency"/>
        <result column="unpaid_amount" property="unpaidAmountInBillCurrency"/>
        <!-- ... 其他字段映射 -->
    </resultMap>

    <!-- INSERT -->
    <insert id="insert" parameterType="com.szt.supplychain.bms.model.ArBill"
            useGeneratedKeys="true" keyProperty="id" keyColumn="id">
        INSERT INTO ar_bill (
            bill_no, bill_title, bill_status, bill_config_id, config_type,
            sc_id, shop_id, user_id, member_code, member_name,
            customer_no, customer_name, destination_country,
            bill_currency, fin_currency,
            initial_receivable_amount, receivable_amount, paid_amount, unpaid_amount,
            receivable_amount_fin, paid_amount_fin
        ) VALUES (
            #{billNo}, #{billTitle}, #{billStatus}, #{billConfigId}, #{configType},
            #{scId}, #{shopId}, #{userId}, #{memberCode}, #{memberName},
            #{customerNo}, #{customerName}, #{destinationCountry},
            #{billCurrency}, #{finCurrency},
            #{initialReceivableAmountInBillCurrency}, #{receivableAmountInBillCurrency},
            #{paidAmountInBillCurrency}, #{unpaidAmountInBillCurrency},
            #{receivableAmountInFinCurrency}, #{paidAmountInFinCurrency}
        )
    </insert>

    <!-- 单条查询 -->
    <select id="selectByBillNo" resultMap="BaseResultMap">
        SELECT <include refid="BaseColumnList"/>
        FROM ar_bill
        WHERE bill_no = #{billNo} AND is_deleted = 0
    </select>

    <!-- 单条查询 + 行锁 -->
    <select id="selectByBillNoForUpdate" resultMap="BaseResultMap">
        SELECT <include refid="BaseColumnList"/>
        FROM ar_bill
        WHERE bill_no = #{billNo} AND is_deleted = 0
        FOR UPDATE
    </select>

    <!-- COUNT -->
    <select id="countByCondition" parameterType="com.szt.supplychain.bms.model.dto.ArBillQueryReqDTO"
            resultType="java.lang.Long">
        SELECT COUNT(1) FROM ar_bill
        <include refid="QueryWhere"/>
    </select>

    <!-- 分页查询 -->
    <select id="selectPageByCondition" parameterType="com.szt.supplychain.bms.model.dto.ArBillQueryReqDTO"
            resultMap="BaseResultMap">
        SELECT <include refid="BaseColumnList"/>
        FROM ar_bill
        <include refid="QueryWhere"/>
        ORDER BY billing_period_end_date DESC, id DESC
        LIMIT #{limit} OFFSET #{offset}
    </select>

    <!-- 汇总查询 -->
    <select id="selectSummaryByCondition" parameterType="com.szt.supplychain.bms.model.dto.ArBillQueryReqDTO"
            resultType="com.szt.supplychain.bms.model.dto.ArBillPageRespDTO">
        SELECT
            COALESCE(SUM(receivable_amount), 0) AS receivableAmount,
            COALESCE(SUM(paid_amount), 0) AS paidAmount,
            SUM(CASE WHEN bill_status != 'PAID' THEN 1 ELSE 0 END) AS pendingCount,
            SUM(CASE WHEN payment_overdue_days &gt; 0 AND bill_status != 'PAID' THEN 1 ELSE 0 END) AS overdueCount
        FROM ar_bill
        <include refid="QueryWhere"/>
    </select>

    <!-- UPDATE -->
    <update id="updateStatusByBillNo">
        UPDATE ar_bill
        SET bill_status = #{status}, confirmed_at = NOW(), confirmed_by = #{operator},
            updated_by = #{operator}, updated_at = NOW()
        WHERE bill_no = #{billNo} AND is_deleted = 0
    </update>

</mapper>
```

#### 3.7.3 XML Mapper 关键规范

1. **namespace 必须与 Mapper 接口全限定名一致**
   ```xml
   <mapper namespace="com.szt.supplychain.bms.dao.mapper.ArBillMapper">
   ```

2. **用 `<sql>` + `<include>` 复用列和条件片段**
   - `BaseColumnList`：所有查询共用的列
   - `QueryWhere`：共用的 WHERE 条件（含数据隔离、逻辑删除、业务过滤）

3. **动态条件用 `<if>` 标签**，不用 Java 字符串拼接
   ```xml
   <!-- 正确 -->
   <if test="scId != null">AND sc_id = #{scId}</if>

   <!-- 错误：不要在 XML 中拼接字符串 -->
   <!-- AND sc_id = '${scId}'  ← 有SQL注入风险 -->
   ```

4. **分页查询必须先 COUNT 再 SELECT**，分页参数 `#{limit}` `#{offset}` 来自 DTO 的 `getLimit()` / `getOffset()`

5. **resultMap 显式映射**，不用 `resultType` 自动映射（驼峰转换可能遗漏）
   ```xml
   <resultMap id="BaseResultMap" type="com.szt.supplychain.bms.model.ArBill">
       <id column="id" property="id"/>
       <result column="bill_no" property="billNo"/>
   </resultMap>
   ```

6. **INSERT 使用 `useGeneratedKeys`** 回写主键
   ```xml
   <insert id="insert" parameterType="..." useGeneratedKeys="true" keyProperty="id" keyColumn="id">
   ```

7. **XML 文件放在 `dao/src/main/resources/sqlmap/`**，application.yml 中配置 mapper-locations

#### 3.7.4 极少数简单静态查询可用注解

只有**极其简单的单表单行查询**（无动态条件，SQL 不超过 3 行）才允许用 `@Select` 注解直接写在 Mapper 接口中：

```java
/**
 * 按账单编号和订单编号统计主订单数量。
 *
 * @param billNo 账单编号
 * @param orderNo 订单编号
 * @return 匹配的主订单数量
 */
@Select("SELECT COUNT(1) FROM main_order WHERE bill_no = #{billNo} AND order_no = #{orderNo}")
int countMainOrderInBill(@Param("billNo") String billNo, @Param("orderNo") String orderNo);
```

**一旦有任何动态条件、涉及分页、或超过 3 行 SQL，必须走 XML，禁止使用 SqlProvider。**

---

## 4 API 设计规范

### 4.1 URL 命名规则

```
/api/{service}/{module}

示例：/api/bms/ar-bill
```

| URL | HTTP Method | 说明 |
|-----|-------------|------|
| `/api/bms/ar-bill/page` | POST | 分页查询 |
| `/api/bms/ar-bill/detail?billNo=xxx` | GET | 详情查询 |
| `/api/bms/ar-bill/confirm` | POST | 确认（写操作） |
| `/api/bms/ar-bill/fee-detail/page` | POST | 子资源分页 |
| `/api/bms/ar-bill/exchange-rate/save` | POST | 子资源保存 |
| `/api/bms/ar-bill/regenerate-order` | POST | 动作类接口 |

**规则**：
- 所有 URL 使用 kebab-case（短横线分隔）：`ar-bill`，`fee-detail`，`exchange-rate`
- 读操作用 GET + `@RequestParam`，写操作用 POST + `@RequestBody`
- 分页查询一律用 POST（因为查询条件可能很多，放 RequestBody 更合理）
- 子资源嵌套：`/fee-detail/page`，`/order/page`

### 4.2 请求 / 响应 DTO 规范

#### 4.2.1 请求 DTO

```java
@Data
public class ArBillQueryReqDTO {
    /**
     * 页码，从 1 开始。
     */
    private Integer pageNo = 1;

    /**
     * 每页条数。
     */
    private Integer pageSize = 20;

    /**
     * 账单编号，支持模糊搜索。
     */
    private String billNo;

    /**
     * 账单状态，精确匹配。
     */
    private String billStatus;

    /**
     * 供应链ID，数据隔离必填字段。
     */
    private Long scId;

    /**
     * 店铺ID，数据隔离必填字段。
     */
    private Long shopId;

    /**
     * 用户ID，数据隔离必填字段。
     */
    private Long userId;
    // ... 其他业务查询条件

    /**
     * 计算 SQL 查询偏移量。
     *
     * @return SQL OFFSET 值
     */
    public Integer getOffset() {
        int page = pageNo == null || pageNo < 1 ? 1 : pageNo;
        int size = getLimit();
        return (page - 1) * size;
    }

    /**
     * 计算 SQL 查询条数，最大值为 200。
     *
     * @return SQL LIMIT 值
     */
    public Integer getLimit() {
        if (pageSize == null || pageSize < 1) { return 20; }
        return Math.min(pageSize, 200);
    }
}
```

#### 4.2.2 响应 DTO

```java
@Data
public class ArBillPageRespDTO {
    /**
     * 当前页码。
     */
    private Integer pageNo;

    /**
     * 每页条数。
     */
    private Integer pageSize;

    /**
     * 总记录数。
     */
    private Long total = 0L;

    /**
     * 当前页应收账单数据。
     */
    private List<ArBillDTO> records = new ArrayList<>();

    /**
     * 应收金额汇总。
     */
    private BigDecimal receivableAmount = BigDecimal.ZERO;

    /**
     * 已收金额汇总。
     */
    private BigDecimal paidAmount = BigDecimal.ZERO;
    // ...
}
```

**注释要求**：请求 DTO、响应 DTO 的所有字段及其辅助方法必须使用标准多行 JavaDoc；方法注释还必须包含完整的 `@param`（如有入参）和 `@return` 说明。

#### 4.2.3 Feign Client 契约

```java
@FeignClient(name = "tmall-bms-service", path = "/api/bms/ar-bill")
public interface ArBillRemoteService {

    /**
     * 分页查询应收账单。
     *
     * @param reqDTO 查询条件
     * @return 应收账单分页数据
     */
    @PostMapping("/page")
    ArBillPageRespDTO page(@RequestBody(required = false) ArBillQueryReqDTO reqDTO);

    /**
     * 根据账单编号查询应收账单详情。
     *
     * @param billNo 账单编号
     * @return 应收账单详情
     */
    @GetMapping("/detail")
    ArBillDetailRespDTO detail(@RequestParam("billNo") String billNo);

    /**
     * 确认应收账单。
     *
     * @param reqDTO 账单确认请求参数
     * @return 是否确认成功
     */
    @PostMapping("/confirm")
    Boolean confirm(@RequestBody ArBillActionReqDTO reqDTO);
    // ...
}
```

**规则**：
- `@FeignClient(name = "tmall-bms-service")` name 对应 Eureka 注册名
- `path` 与 Controller 的 `@RequestMapping` 一致
- 方法签名与 Controller 完全一致（Controller `implements` 此接口）
- 每个接口方法必须使用标准多行 JavaDoc，说明接口用途、`@param` 参数含义与 `@return` 返回内容
- 外部服务只需引入 `client` 模块即可调用

### 4.3 完整调用链路（以应收账单列表为例）

```
前端 (admin-front)
  │
  │  POST /api/bms/ar-bill/page
  │  Body: { scId: 1, shopId: 2, pageNo: 1, pageSize: 20 }
  ▼
┌──────────────────────────────────────────────────────────────┐
│ Admin / Platform Admin (网关服务)                              │
│   路由转发 → tmall-bms-service                                 │
└──────────────────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────────────────┐
│ BMS - ArBillController                                       │
│   @PostMapping("/page")                                      │
│   public ArBillPageRespDTO page(@RequestBody ...)             │
│       → arBillService.page(reqDTO)                           │
└──────────────────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────────────────┐
│ BMS - ArBillServiceImpl                                      │
│   public ArBillPageRespDTO page(ArBillQueryReqDTO query)     │
│       1. safeQuery = null防御                                 │
│       2. total = mapper.countByCondition(safeQuery)            │
│       3. records = mapper.selectPageByCondition(safeQuery)     │
│       4. 组装 PageRespDTO（pageNo, pageSize, total, records） │
│       5. 查询汇总数据 selectSummaryByCondition                 │
└──────────────────────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────────────────────┐
│ BMS - ArBillMapper + ArBill-mapper.xml                       │
│   countByCondition:  SELECT COUNT(1) FROM ar_bill            │
│       <include refid="QueryWhere"/>                          │
│   selectPageByCondition:  SELECT ... FROM ar_bill            │
│       <include refid="QueryWhere"/>                          │
│       ORDER BY ... LIMIT #{limit} OFFSET #{offset}            │
│   selectSummaryByCondition:  SELECT SUM(...) FROM ar_bill   │
│       <include refid="QueryWhere"/>                          │
└──────────────────────────────────────────────────────────────┘
```

---

## 5 数据库表命名规范

### 5.1 表命名规则

| 规则 | 示例 |
|------|------|
| 全小写，下划线分隔 | `ar_bill`, `fee_detail`, `payment_receipt` |
| 业务前缀 + 实体名 | `ar_` (应收), `fee_` (费用), `payment_` (收付) |
| 关联表用主表名 + `_detail` / `_summary` | `ar_bill_currency_summary`, `payment_writeoff_detail` |
| 逻辑删除字段 `is_deleted` | `is_deleted TINYINT DEFAULT 0` |

### 5.2 字段命名规则

| 规则 | 正确示例 | 错误示例 |
|------|----------|----------|
| 全小写，下划线分隔 | `bill_no`, `sc_id`, `created_at` | `billNo`, `scId` |
| 布尔型前缀 `is_` | `is_deleted` | `deleted` |
| 时间字段后缀 `_at` / `_date` | `created_at`, `billing_period_end_date` | `createTime` |
| 外键使用关联表字段名 | `bill_id`, `bill_no`, `receipt_id` | `fk_bill` |
| 金额字段标明币种 / 单位 | `receivable_amount`, `paid_amount_in_bill_currency` | `amount` |
| 数据隔离三字段必须 | `sc_id`, `shop_id`, `user_id` | — |

### 5.3 数据隔离三字段（每张业务表必须包含）

```sql
CREATE TABLE ar_bill (
    -- 数据隔离三字段（最前面的列）
    sc_id        BIGINT       NOT NULL COMMENT '供应链ID',
    shop_id      BIGINT       NOT NULL COMMENT '店铺ID',
    user_id      BIGINT       NOT NULL COMMENT '用户ID',
    -- ...
    PRIMARY KEY (id),
    INDEX idx_sc_shop_user (sc_id, shop_id, user_id)
) COMMENT='应收账单';
```

### 5.4 完整建表示例（ar_bill 核心字段）

```sql
CREATE TABLE ar_bill (
    id                              BIGINT AUTO_INCREMENT COMMENT 'ID',
    bill_no                         VARCHAR(64)  NOT NULL COMMENT '账单编号',
    bill_title                      VARCHAR(255) COMMENT '账单标题',
    bill_status                     VARCHAR(32)  NOT NULL COMMENT '账单状态: GENERATED/CONFIRMED/PAID/PART_PAID',
    bill_config_id                  BIGINT       COMMENT '账单配置ID',
    config_type                     VARCHAR(32)  DEFAULT 'DEFAULT' COMMENT '配置类型: DEFAULT/BRANCH',
    generate_task_id                 BIGINT       COMMENT '生成任务ID',

    -- 数据隔离三字段
    sc_id                           BIGINT       NOT NULL COMMENT '供应链ID',
    shop_id                         BIGINT       NOT NULL COMMENT '店铺ID',
    user_id                         BIGINT       NOT NULL COMMENT '用户ID',
    member_code                     VARCHAR(64)  COMMENT '会员编码',
    member_name                     VARCHAR(255) COMMENT '会员名称',
    customer_no                     VARCHAR(64)  COMMENT '外部客户编号',
    customer_name                   VARCHAR(255) COMMENT '客户名称',
    destination_country             VARCHAR(8)   COMMENT '集运目的国',
    consolidation_warehouse_code    VARCHAR(64)  COMMENT '集运仓编码',
    billing_cycle_type              VARCHAR(32)  COMMENT '账期类型',
    billing_period_start_date       DATE         COMMENT '账期起始日',
    billing_period_end_date         DATE         COMMENT '账期结束日',
    bill_send_date                  DATE         COMMENT '账单发送日',
    credit_period_end_date          DATE         COMMENT '信用期结束日',
    payment_overdue_days             INT          DEFAULT 0 COMMENT '付款逾期天数',

    -- 金额字段（标明币种维度）
    bill_currency                   VARCHAR(8)   NOT NULL DEFAULT 'CNY' COMMENT '结算币种',
    fin_currency                    VARCHAR(8)   NOT NULL DEFAULT 'CNY' COMMENT '财务本位币',
    initial_receivable_amount       DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '初始应收金额',
    this_adjustment_delta_amount    DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '本期调整增量',
    previous_adjustment_delta_amount DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '往期调整增量',
    late_fee_amount                 DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '滞纳金额',
    receivable_amount               DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '应收金额',
    paid_amount                     DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '实收金额',
    unpaid_amount                   DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '未核销金额',
    receivable_amount_fin           DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '应收金额(财务本位币)',
    paid_amount_fin                 DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '实收金额(财务本位币)',

    -- 审计字段
    is_deleted                      TINYINT      NOT NULL DEFAULT 0 COMMENT '逻辑删除: 0正常 1删除',
    created_at                      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    created_by                      VARCHAR(64)  COMMENT '创建人',
    updated_at                      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    updated_by                      VARCHAR(64)  COMMENT '更新人',

    PRIMARY KEY (id),
    UNIQUE KEY uk_bill_no (bill_no),
    INDEX idx_sc_shop_user (sc_id, shop_id, user_id),
    INDEX idx_bill_status (bill_status),
    INDEX idx_billing_period (billing_period_start_date, billing_period_end_date)
) COMMENT='应收账单';
```

### 5.5 数据库结构归档同步规范

`aidocs/technical-caliber/sql/ar_bill.sql` 是 BMS 数据库表结构的统一归档文件。**每次代码修改涉及数据库表结构变化时，必须在同一次修改中同步更新该文件。**

#### 5.5.1 必须同步的变更范围

- 新增、删除或重命名表
- 新增、删除、重命名或修改字段
- 修改字段类型、长度、精度、是否为空、默认值或注释
- 新增、删除或修改主键、唯一索引、普通索引、外键或其他约束
- 修改表注释、字符集、排序规则或其他影响表结构的属性

#### 5.5.2 归档要求

1. 归档文件必须保存变更后完整、可执行的最新表结构，字段、索引、默认值和注释必须与实际设计一致。
2. 不允许只在需求文档、Java 实体、Mapper XML 或临时迁移 SQL 中修改字段，而遗漏 `aidocs/technical-caliber/sql/ar_bill.sql`。
3. 不允许仅追加零散 `ALTER TABLE` 语句作为最终归档；应同步更新对应表的完整 `CREATE TABLE` 定义。
4. 归档文件只保存表结构，不写入业务数据，不添加 `INSERT` 数据语句。
5. 若代码修改不涉及数据库表结构，禁止为了格式化或刷新导出时间而无意义修改归档文件。
6. 提交前必须核对数据库字段、Java 实体字段、Mapper 映射与归档 SQL 四者一致。

#### 5.5.3 完成判定

涉及库表修改的开发任务，只有在代码与 `aidocs/technical-caliber/sql/ar_bill.sql` 均完成同步并通过差异检查后，才视为完成。

---

## 6 常见业务模块实现

### 6.1 分页查询

本节 Java 示例中的 DTO 字段、接口方法、业务方法和工具方法均必须使用标准多行 JavaDoc；方法注释须包含完整的 `@param` 和 `@return` 说明。

#### 6.1.1 请求 DTO

```java
@Data
public class ArBillQueryReqDTO {

    /**
     * 页码，从 1 开始。
     */
    private Integer pageNo = 1;

    /**
     * 每页条数。
     */
    private Integer pageSize = 20;

    /**
     * 供应链ID，用于数据隔离。
     */
    private Long scId;

    /**
     * 店铺ID，用于数据隔离。
     */
    private Long shopId;

    /**
     * 用户ID，用于数据隔离。
     */
    private Long userId;

    /**
     * 计算 SQL 查询偏移量。
     *
     * @return SQL OFFSET 值
     */
    public Integer getOffset() {
        int page = pageNo == null || pageNo < 1 ? 1 : pageNo;
        int size = getLimit();
        return (page - 1) * size;
    }

    /**
     * 计算 SQL 查询条数，最大值为 200。
     *
     * @return SQL LIMIT 值
     */
    public Integer getLimit() {
        if (pageSize == null || pageSize < 1) { return 20; }
        return Math.min(pageSize, 200);
    }
}
```

#### 6.1.2 响应 DTO

```java
@Data
public class ArBillPageRespDTO {
    /**
     * 当前页码。
     */
    private Integer pageNo;

    /**
     * 每页条数。
     */
    private Integer pageSize;

    /**
     * 总记录数。
     */
    private Long total = 0L;

    /**
     * 当前页应收账单数据。
     */
    private List<ArBillDTO> records = new ArrayList<>();

    /**
     * 应收金额汇总。
     */
    private BigDecimal receivableAmount = BigDecimal.ZERO;

    /**
     * 已收金额汇总。
     */
    private BigDecimal paidAmount = BigDecimal.ZERO;
}
```

#### 6.1.3 Service 层分页逻辑（先 COUNT 再 SELECT）

```java
/**
 * 按查询条件分页查询应收账单。
 *
 * @param query 查询条件及分页参数
 * @return 应收账单分页数据
 */
@Override
public ArBillPageRespDTO page(ArBillQueryReqDTO query) {
    ArBillQueryReqDTO safeQuery = query == null ? new ArBillQueryReqDTO() : query;

    Long total = arBillMapper.countByCondition(safeQuery);

    List<ArBill> records = total == null || total == 0
            ? Collections.emptyList()
            : arBillMapper.selectPageByCondition(safeQuery);

    ArBillPageRespDTO respDTO = new ArBillPageRespDTO();
    respDTO.setPageNo(safeQuery.getPageNo() == null ? 1 : safeQuery.getPageNo());
    respDTO.setPageSize(safeQuery.getLimit());
    respDTO.setTotal(total == null ? 0L : total);

    List<ArBillDTO> billRecords = records.stream().map(this::toDTO).collect(Collectors.toList());
    respDTO.setRecords(billRecords);

    ArBillPageRespDTO summary = arBillMapper.selectSummaryByCondition(safeQuery);
    if (summary != null) {
        respDTO.setReceivableAmount(defaultAmount(summary.getReceivableAmount()));
        respDTO.setPaidAmount(defaultAmount(summary.getPaidAmount()));
    }
    return respDTO;
}
```

#### 6.1.4 Mapper 层分页 SQL（LIMIT / OFFSET）

Mapper 接口只做方法声明，SQL 全部放在 XML 中；每个方法必须使用标准多行 JavaDoc，说明用途、`@param` 参数含义与 `@return` 返回内容：

**Mapper 接口** `ArBillMapper.java`：

```java
@Mapper
public interface ArBillMapper {
    /**
     * 按查询条件统计应收账单数量。
     *
     * @param query 查询条件
     * @return 应收账单数量
     */
    Long countByCondition(ArBillQueryReqDTO query);

    /**
     * 按查询条件分页查询应收账单。
     *
     * @param query 查询条件及分页参数
     * @return 当前页的应收账单列表
     */
    List<ArBill> selectPageByCondition(ArBillQueryReqDTO query);

    /**
     * 按查询条件汇总应收账单数据。
     *
     * @param query 查询条件
     * @return 应收账单汇总数据
     */
    ArBillPageRespDTO selectSummaryByCondition(ArBillQueryReqDTO query);
}
```

**XML Mapper** `sqlmap/ArBill-mapper.xml`：

```xml
<!-- COUNT -->
<select id="countByCondition" parameterType="com.szt.supplychain.bms.model.dto.ArBillQueryReqDTO"
        resultType="java.lang.Long">
    SELECT COUNT(1) FROM ar_bill
    <include refid="QueryWhere"/>
</select>

<!-- 分页查询 -->
<select id="selectPageByCondition" parameterType="com.szt.supplychain.bms.model.dto.ArBillQueryReqDTO"
        resultMap="BaseResultMap">
    SELECT <include refid="BaseColumnList"/>
    FROM ar_bill
    <include refid="QueryWhere"/>
    ORDER BY billing_period_end_date DESC, id DESC
    LIMIT #{limit} OFFSET #{offset}
</select>

<!-- 汇总查询 -->
<select id="selectSummaryByCondition" parameterType="com.szt.supplychain.bms.model.dto.ArBillQueryReqDTO"
        resultType="com.szt.supplychain.bms.model.dto.ArBillPageRespDTO">
    SELECT
        COALESCE(SUM(receivable_amount), 0) AS receivableAmount,
        COALESCE(SUM(paid_amount), 0) AS paidAmount,
        SUM(CASE WHEN bill_status != 'PAID' THEN 1 ELSE 0 END) AS pendingCount,
        SUM(CASE WHEN payment_overdue_days &gt; 0 AND bill_status != 'PAID' THEN 1 ELSE 0 END) AS overdueCount
    FROM ar_bill
    <include refid="QueryWhere"/>
</select>
```

#### 6.1.5 内存分页（用于聚合后数据）

当数据需要先在内存中加工再分页时，使用 `List.subList`：

```java
/**
 * 对聚合后的列表进行内存分页。
 *
 * @param list 待分页的数据列表
 * @param pageNo 页码，从 1 开始
 * @param pageSize 每页条数
 * @param <T> 列表元素类型
 * @return 当前页的数据列表
 */
private <T> List<T> pageSlice(List<T> list, int pageNo, int pageSize) {
    if (list == null || list.isEmpty()) { return Collections.emptyList(); }
    int from = Math.min((pageNo - 1) * pageSize, list.size());
    int to = Math.min(from + pageSize, list.size());
    return list.subList(from, to);
}
```

---

### 6.2 权限信息

#### 6.2.1 BMS 权限架构

BMS 作为纯后端微服务，**自身不做用户认证和权限校验**。权限由调用方（Admin / Platform Admin）控制：

```
前端请求 → Admin 网关 (鉴权 + 数据隔离拦截) → BMS 微服务 (纯业务逻辑)
```

#### 6.2.2 数据隔离字段传递

所有请求 DTO 必须携带数据隔离三字段：

```java
@Data
public class ArBillQueryReqDTO {
    /**
     * 供应链ID，数据隔离必填字段。
     */
    private Long scId;

    /**
     * 店铺ID，数据隔离必填字段。
     */
    private Long shopId;

    /**
     * 用户ID，数据隔离必填字段。
     */
    private Long userId;
}
```

#### 6.2.3 写操作数据隔离校验

在写操作 Service 中，必须验证数据隔离三字段不为空：

```java
private void validateSaveCustomerDimension(ArBillSaveDTO saveDTO) {
    if (saveDTO == null) {
        throw new BusinessException("500", "账单保存请求不能为空");
    }
    if (saveDTO.getScId() == null || saveDTO.getShopId() == null || saveDTO.getUserId() == null
            || !hasText(saveDTO.getMemberCode())) {
        throw new BusinessException("500", "账单保存必须包含 scId/shopId/userId/memberCode，禁止使用默认供应链");
    }
}
```

#### 6.2.4 Admin 侧数据隔离拦截器

`sharding_key.properties` 描述了 Admin 服务侧的自动数据隔离拦截：

```properties
content=[
  {"tableName":"dealer_shop","keys":[
    {"key":"org_id","allowValueAbsent":"true","column":"sc_id"}
  ]},
  {"tableName":"customer_info","keys":[
    {"key":"shop_id","secKey":"permit_shopid_list","allowValueAbsent":"true","nullWarning":"true",
     "onlyWebReq":"true","column":"dealer_shop_id"}
  ]}
]
```

Admin 在 SQL 执行前自动注入 `WHERE sc_id = #{scId}` / `WHERE shop_id IN (permit_shopid_list)` 条件。

---

### 6.3 供应链数据隔离

#### 6.3.1 三维隔离体系

BMS 使用 `scId`（供应链） + `shopId`（店铺） + `userId`（用户） 三维数据隔离：

```
供应链(scId) → 店铺(shopId) → 用户(userId)
```

#### 6.3.2 Mapper 层 WHERE 条件注入

**原则：每个查询都包含数据隔离条件，且放在 WHERE 子句最前面**

XML Mapper 示例（推荐）：

```xml
<sql id="QueryWhere">
    WHERE is_deleted = 0
    <!-- 数据隔离条件（必须放在最前面） -->
    <if test="scId != null">AND sc_id = #{scId}</if>
    <if test="shopId != null">AND shop_id = #{shopId}</if>
    <if test="userId != null">AND user_id = #{userId}</if>
    <!-- 业务过滤条件 -->
    <if test="billNo != null and billNo != ''">
        AND bill_no LIKE CONCAT('%', #{billNo}, '%')
    </if>
    <if test="billStatus != null and billStatus != '' and billStatus != 'all'">
        AND bill_status = #{billStatus}
    </if>
    <if test="overdueOnly != null and overdueOnly">
        AND payment_overdue_days &gt; 0 AND bill_status != 'PAID'
    </if>
    <if test="customerName != null and customerName != ''">
        AND (customer_name LIKE CONCAT('%', #{customerName}, '%')
            OR member_name LIKE CONCAT('%', #{customerName}, '%'))
    </if>
</sql>
```

所有查询统一 `<include refid="QueryWhere"/>` 引用：

```xml
<select id="countByCondition" ...>
    SELECT COUNT(1) FROM ar_bill <include refid="QueryWhere"/>
</select>

<select id="selectPageByCondition" ...>
    SELECT <include refid="BaseColumnList"/> FROM ar_bill
    <include refid="QueryWhere"/>
    ORDER BY billing_period_end_date DESC, id DESC
    LIMIT #{limit} OFFSET #{offset}
</select>
```

XML Mapper 等价写法：

```xml
<sql id="QueryWhere">
    WHERE is_deleted = 0
    <if test="scId != null">AND sc_id = #{scId}</if>
    <if test="shopId != null">AND shop_id = #{shopId}</if>
    <if test="userId != null">AND user_id = #{userId}</if>
    <if test="billNo != null and billNo != ''">
        AND bill_no LIKE CONCAT('%', #{billNo}, '%')
    </if>
</sql>
```

#### 6.3.3 跨表查询的数据隔离

当查询涉及 JOIN 多张表时，每张表都必须加数据隔离。使用 XML `<sql>` 片段配合表别名：

```xml
<!-- 核销流水查询：三表 JOIN 的 WHERE 片段 -->
<sql id="PaymentWhere">
    WHERE 1 = 1
    <!-- wd 表（payment_writeoff_detail）的数据隔离 -->
    <if test="scId != null">AND wd.sc_id = #{scId}</if>
    <if test="shopId != null">AND wd.shop_id = #{shopId}</if>
    <if test="userId != null">AND wd.user_id = #{userId}</if>
    <!-- 业务条件 -->
    <if test="writeoffNo != null and writeoffNo != ''">
        AND wd.writeoff_no LIKE CONCAT('%', #{writeoffNo}, '%')
    </if>
    <if test="receiptNo != null and receiptNo != ''">
        AND wd.receipt_no LIKE CONCAT('%', #{receiptNo}, '%')
    </if>
    <if test="writeoffStatus != null and writeoffStatus != '' and writeoffStatus != 'all'">
        AND wd.writeoff_status = #{writeoffStatus}
    </if>
    <if test="paymentChannel != null and paymentChannel != ''">
        AND pr.payment_channel = #{paymentChannel}
    </if>
    <if test="writeoffStartDate != null">
        AND wd.writeoff_time &gt;= #{writeoffStartDate}
    </if>
    <if test="writeoffEndDate != null">
        AND wd.writeoff_time &lt; DATE_ADD(#{writeoffEndDate}, INTERVAL 1 DAY)
    </if>
</sql>

<select id="countPaymentsByCondition" ...>
    SELECT COUNT(1)
    FROM payment_writeoff_detail wd
    LEFT JOIN payment_receipt pr ON pr.id = wd.receipt_id
    LEFT JOIN ar_bill b ON b.bill_no = wd.bill_no
    <include refid="PaymentWhere"/>
</select>

<select id="selectPaymentsByCondition" ...>
    SELECT wd.id, wd.writeoff_no AS writeoffNo, wd.bill_no AS billNo, ...
    FROM payment_writeoff_detail wd
    LEFT JOIN payment_receipt pr ON pr.id = wd.receipt_id
    LEFT JOIN ar_bill b ON b.bill_no = wd.bill_no
    <include refid="PaymentWhere"/>
    ORDER BY wd.writeoff_time DESC, wd.id DESC
    LIMIT #{limit} OFFSET #{offset}
</select>
```

#### 6.3.4 写操作也必须携带数据隔离字段

XML Mapper 中 INSERT 语句必须包含 `sc_id`, `shop_id`, `user_id`：

```xml
<insert id="insertPaymentReceipt" parameterType="com.szt.supplychain.bms.model.PaymentReceipt"
        useGeneratedKeys="true" keyProperty="id" keyColumn="id">
    INSERT INTO payment_receipt (
        receipt_no, sc_id, shop_id, user_id, member_code, payer_name,
        payment_channel, receipt_currency, receipt_amount, writeoff_amount,
        unwriteoff_amount, receipt_status, paid_at, confirmed_by, remark, created_by
    ) VALUES (
        #{receiptNo}, #{scId}, #{shopId}, #{userId}, #{memberCode}, #{payerName},
        #{paymentChannel}, #{receiptCurrency}, #{receiptAmount}, #{writeoffAmount},
        #{unwriteoffAmount}, #{receiptStatus}, COALESCE(#{paidAt}, NOW()), NOW(), #{remark}, #{createdBy}
    )
</insert>
```

**核心原则**：`sc_id`, `shop_id`, `user_id` 三字段必须同步写入，不能遗漏。

---

### 6.4 新模块开发完整示例

以"应付账单（ApBill）"为例，展示从建表到 API 的完整流程：

#### Step 1：数据库建表

```sql
CREATE TABLE ap_bill (
    id                  BIGINT AUTO_INCREMENT COMMENT 'ID',
    bill_no             VARCHAR(64)  NOT NULL COMMENT '应付账单编号',
    bill_status         VARCHAR(32)  NOT NULL COMMENT '状态: GENERATED/CONFIRMED/PAID',
    sc_id               BIGINT       NOT NULL COMMENT '供应链ID',
    shop_id             BIGINT       NOT NULL COMMENT '店铺ID',
    user_id             BIGINT       NOT NULL COMMENT '用户ID',
    member_code         VARCHAR(64)  COMMENT '供应商编码',
    member_name         VARCHAR(255) COMMENT '供应商名称',
    bill_currency       VARCHAR(8)   NOT NULL DEFAULT 'CNY' COMMENT '币种',
    payable_amount      DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '应付金额',
    paid_amount         DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '已付金额',
    is_deleted          TINYINT      NOT NULL DEFAULT 0 COMMENT '逻辑删除',
    created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    created_by          VARCHAR(64)  COMMENT '创建人',
    updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    updated_by          VARCHAR(64)  COMMENT '更新人',
    PRIMARY KEY (id),
    UNIQUE KEY uk_bill_no (bill_no),
    INDEX idx_sc_shop_user (sc_id, shop_id, user_id)
) COMMENT='应付账单';
```

#### Step 2：Model 层（model 模块）

**2a. 实体类** `ApBill.java`：

```java
package com.szt.supplychain.bms.model;

import lombok.Data;
import java.math.BigDecimal;
import java.util.Date;

/**
 * 应付账单
 */
@Data
public class ApBill {
    /**
     * 主键ID。
     */
    private Long id;

    /**
     * 应付账单编号。
     */
    private String billNo;

    /**
     * 账单状态。
     */
    private String billStatus;

    /**
     * 供应链ID。
     */
    private Long scId;

    /**
     * 店铺ID。
     */
    private Long shopId;

    /**
     * 用户ID。
     */
    private Long userId;

    /**
     * 供应商编码。
     */
    private String memberCode;

    /**
     * 供应商名称。
     */
    private String memberName;

    /**
     * 账单币种。
     */
    private String billCurrency;

    /**
     * 应付金额。
     */
    private BigDecimal payableAmount;

    /**
     * 已付金额。
     */
    private BigDecimal paidAmount;

    /**
     * 创建时间。
     */
    private Date createdAt;

    /**
     * 更新时间。
     */
    private Date updatedAt;
}
```

**2b. 查询请求 DTO** `ApBillQueryReqDTO.java`：

```java
package com.szt.supplychain.bms.model.dto;

import lombok.Data;

/**
 * 应付账单列表查询请求
 */
@Data
public class ApBillQueryReqDTO {
    /**
     * 页码，从 1 开始。
     */
    private Integer pageNo = 1;

    /**
     * 每页条数。
     */
    private Integer pageSize = 20;

    /**
     * 供应链ID。
     */
    private Long scId;

    /**
     * 店铺ID。
     */
    private Long shopId;

    /**
     * 用户ID。
     */
    private Long userId;

    /**
     * 账单编号，支持模糊搜索。
     */
    private String billNo;

    /**
     * 账单状态。
     */
    private String billStatus;

    /**
     * 计算 SQL 查询偏移量。
     *
     * @return SQL OFFSET 值
     */
    public Integer getOffset() {
        int page = pageNo == null || pageNo < 1 ? 1 : pageNo;
        return (page - 1) * getLimit();
    }

    /**
     * 计算 SQL 查询条数，最大值为 200。
     *
     * @return SQL LIMIT 值
     */
    public Integer getLimit() {
        if (pageSize == null || pageSize < 1) { return 20; }
        return Math.min(pageSize, 200);
    }
}
```

**2c. 分页响应 DTO** `ApBillPageRespDTO.java`：

```java
package com.szt.supplychain.bms.model.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * 应付账单分页响应
 */
@Data
public class ApBillPageRespDTO {
    /**
     * 当前页码。
     */
    private Integer pageNo;

    /**
     * 每页条数。
     */
    private Integer pageSize;

    /**
     * 总记录数。
     */
    private Long total = 0L;

    /**
     * 当前页应付账单数据。
     */
    private List<ApBillDTO> records = new ArrayList<>();

    /**
     * 应付金额汇总。
     */
    private BigDecimal totalPayableAmount = BigDecimal.ZERO;

    /**
     * 已付金额汇总。
     */
    private BigDecimal totalPaidAmount = BigDecimal.ZERO;
}
```

#### Step 3：Mapper 层（dao 模块）

**3a. Mapper 接口** `ApBillMapper.java` — 只声明方法，不含 SQL；每个方法必须使用标准多行 JavaDoc，说明用途、`@param` 参数含义与 `@return` 返回内容：

```java
package com.szt.supplychain.bms.dao.mapper;

import com.szt.supplychain.bms.model.ApBill;
import com.szt.supplychain.bms.model.dto.ApBillPageRespDTO;
import com.szt.supplychain.bms.model.dto.ApBillQueryReqDTO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 应付账单Mapper
 */
@Mapper
public interface ApBillMapper {

    /**
     * 新增应付账单。
     *
     * @param apBill 应付账单实体
     * @return 受影响的记录数
     */
    int insert(ApBill apBill);

    /**
     * 根据账单编号查询应付账单。
     *
     * @param billNo 账单编号
     * @return 应付账单；不存在时返回 {@code null}
     */
    ApBill selectByBillNo(@Param("billNo") String billNo);

    /**
     * 按查询条件统计应付账单数量。
     *
     * @param query 查询条件
     * @return 应付账单数量
     */
    Long countByCondition(ApBillQueryReqDTO query);

    /**
     * 按查询条件分页查询应付账单。
     *
     * @param query 查询条件及分页参数
     * @return 当前页的应付账单列表
     */
    List<ApBill> selectPageByCondition(ApBillQueryReqDTO query);

    /**
     * 按查询条件汇总应付账单数据。
     *
     * @param query 查询条件
     * @return 应付账单汇总数据
     */
    ApBillPageRespDTO selectSummaryByCondition(ApBillQueryReqDTO query);
}
```

**XML Mapper** — `sqlmap/ApBill-mapper.xml`：

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
        "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.szt.supplychain.bms.dao.mapper.ApBillMapper">

    <!-- 列片段 -->
    <sql id="BaseColumnList">
        id, bill_no, bill_status, sc_id, shop_id, user_id,
        member_code, member_name, bill_currency,
        payable_amount, paid_amount,
        is_deleted, created_at, created_by, updated_at, updated_by
    </sql>

    <!-- 数据隔离 + 业务过滤 WHERE 片段 -->
    <sql id="QueryWhere">
        WHERE is_deleted = 0
        <!-- 数据隔离三字段（必须放在最前面） -->
        <if test="scId != null">AND sc_id = #{scId}</if>
        <if test="shopId != null">AND shop_id = #{shopId}</if>
        <if test="userId != null">AND user_id = #{userId}</if>
        <!-- 业务条件 -->
        <if test="billNo != null and billNo != ''">
            AND bill_no LIKE CONCAT('%', #{billNo}, '%')
        </if>
        <if test="billStatus != null and billStatus != '' and billStatus != 'all'">
            AND bill_status = #{billStatus}
        </if>
    </sql>

    <!-- 结果映射 -->
    <resultMap id="BaseResultMap" type="com.szt.supplychain.bms.model.ApBill">
        <id column="id" property="id"/>
        <result column="bill_no" property="billNo"/>
        <result column="bill_status" property="billStatus"/>
        <result column="sc_id" property="scId"/>
        <result column="shop_id" property="shopId"/>
        <result column="user_id" property="userId"/>
        <result column="member_code" property="memberCode"/>
        <result column="member_name" property="memberName"/>
        <result column="bill_currency" property="billCurrency"/>
        <result column="payable_amount" property="payableAmount"/>
        <result column="paid_amount" property="paidAmount"/>
        <result column="created_at" property="createdAt"/>
        <result column="updated_at" property="updatedAt"/>
    </resultMap>

    <!-- INSERT -->
    <insert id="insert" parameterType="com.szt.supplychain.bms.model.ApBill"
            useGeneratedKeys="true" keyProperty="id" keyColumn="id">
        INSERT INTO ap_bill (
            bill_no, bill_status, sc_id, shop_id, user_id,
            member_code, member_name, bill_currency,
            payable_amount, paid_amount
        ) VALUES (
            #{billNo}, #{billStatus}, #{scId}, #{shopId}, #{userId},
            #{memberCode}, #{memberName}, #{billCurrency},
            #{payableAmount}, #{paidAmount}
        )
    </insert>

    <!-- 单条查询 -->
    <select id="selectByBillNo" resultMap="BaseResultMap">
        SELECT <include refid="BaseColumnList"/>
        FROM ap_bill
        WHERE bill_no = #{billNo} AND is_deleted = 0
    </select>

    <!-- COUNT -->
    <select id="countByCondition" parameterType="com.szt.supplychain.bms.model.dto.ApBillQueryReqDTO"
            resultType="java.lang.Long">
        SELECT COUNT(1) FROM ap_bill
        <include refid="QueryWhere"/>
    </select>

    <!-- 分页查询 -->
    <select id="selectPageByCondition" parameterType="com.szt.supplychain.bms.model.dto.ApBillQueryReqDTO"
            resultMap="BaseResultMap">
        SELECT <include refid="BaseColumnList"/>
        FROM ap_bill
        <include refid="QueryWhere"/>
        ORDER BY id DESC
        LIMIT #{limit} OFFSET #{offset}
    </select>

    <!-- 汇总查询 -->
    <select id="selectSummaryByCondition" parameterType="com.szt.supplychain.bms.model.dto.ApBillQueryReqDTO"
            resultType="com.szt.supplychain.bms.model.dto.ApBillPageRespDTO">
        SELECT
            COALESCE(SUM(payable_amount), 0) AS totalPayableAmount,
            COALESCE(SUM(paid_amount), 0) AS totalPaidAmount
        FROM ap_bill
        <include refid="QueryWhere"/>
    </select>

</mapper>
```

**3c. MyBatis 配置确认**

确保 `application.yml` 中 mapper-locations 包含 XML 路径：

```yaml
mybatis:
  mapper-locations: classpath:sqlmap/*-mapper.xml
  configuration:
    map-underscore-to-camel-case: true
```

Mapper 扫描配置（`BmsMybatisConfig.java` 或启动类）：

```java
@MapperScan("com.szt.supplychain.bms.dao.mapper")
```

#### Step 4：Service 层（biz 模块）

**4a. 接口** `ApBillService.java`：

```java
package com.szt.supplychain.bms.biz.service;

import com.szt.supplychain.bms.model.dto.ApBillPageRespDTO;
import com.szt.supplychain.bms.model.dto.ApBillQueryReqDTO;

/**
 * 应付账单业务处理类
 */
public interface ApBillService {

    /**
     * 分页查询应付账单
     * @param query 查询条件
     * @return 分页数据
     */
    ApBillPageRespDTO page(ApBillQueryReqDTO query);
}
```

**4b. 实现** `ApBillServiceImpl.java`：私有方法必须使用标准多行 JavaDoc，核心业务逻辑必须使用行内注释说明处理目的与关键分支。

```java
package com.szt.supplychain.bms.biz.service.impl;

import com.szt.supplychain.bms.biz.service.ApBillService;
import com.szt.supplychain.bms.dao.mapper.ApBillMapper;
import com.szt.supplychain.bms.model.ApBill;
import com.szt.supplychain.bms.model.dto.ApBillDTO;
import com.szt.supplychain.bms.model.dto.ApBillPageRespDTO;
import com.szt.supplychain.bms.model.dto.ApBillQueryReqDTO;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ApBillServiceImpl implements ApBillService {

    @Resource
    private ApBillMapper apBillMapper;

    @Override
    public ApBillPageRespDTO page(ApBillQueryReqDTO query) {
        // 对空入参使用默认查询对象，确保后续分页参数计算安全。
        ApBillQueryReqDTO safeQuery = query == null ? new ApBillQueryReqDTO() : query;

        // 先统计总数；总数为 0 时跳过分页查询，避免无效 SQL。
        Long total = apBillMapper.countByCondition(safeQuery);
        List<ApBill> records = total == null || total == 0
                ? Collections.emptyList()
                : apBillMapper.selectPageByCondition(safeQuery);

        // 组装分页基础数据，并将实体列表转换为对外 DTO。
        ApBillPageRespDTO respDTO = new ApBillPageRespDTO();
        respDTO.setPageNo(safeQuery.getPageNo() == null ? 1 : safeQuery.getPageNo());
        respDTO.setPageSize(safeQuery.getLimit());
        respDTO.setTotal(total == null ? 0L : total);
        respDTO.setRecords(records.stream().map(this::toDTO).collect(Collectors.toList()));

        // 单独查询金额汇总，避免在分页列表查询中重复聚合。
        ApBillPageRespDTO summary = apBillMapper.selectSummaryByCondition(safeQuery);
        if (summary != null) {
            respDTO.setTotalPayableAmount(defaultAmount(summary.getTotalPayableAmount()));
            respDTO.setTotalPaidAmount(defaultAmount(summary.getTotalPaidAmount()));
        }
        return respDTO;
    }

    /**
     * 将应付账单实体转换为对外传输对象。
     *
     * @param apBill 应付账单实体
     * @return 应付账单传输对象
     */
    private ApBillDTO toDTO(ArBill apBill) {
        ApBillDTO dto = new ApBillDTO();
        dto.setId(apBill.getId());
        dto.setBillNo(apBill.getBillNo());
        dto.setBillStatus(apBill.getBillStatus());
        dto.setScId(apBill.getScId());
        dto.setShopId(apBill.getShopId());
        dto.setUserId(apBill.getUserId());
        dto.setMemberCode(apBill.getMemberCode());
        dto.setMemberName(apBill.getMemberName());
        dto.setBillCurrency(apBill.getBillCurrency());
        dto.setPayableAmount(apBill.getPayableAmount());
        dto.setPaidAmount(apBill.getPaidAmount());
        dto.setCreatedAt(apBill.getCreatedAt());
        dto.setUpdatedAt(apBill.getUpdatedAt());
        return dto;
    }

    /**
     * 将空金额转换为零值，避免金额计算和响应序列化出现空值。
     *
     * @param amount 原始金额
     * @return 原始金额；原始金额为空时返回 {@link BigDecimal#ZERO}
     */
    private BigDecimal defaultAmount(BigDecimal amount) {
        return amount == null ? BigDecimal.ZERO : amount;
    }
}
```

#### Step 5：Client 层（client 模块）

Client 契约中的每个 API 方法必须使用标准多行 JavaDoc，说明接口用途、`@param` 参数含义与 `@return` 返回内容。

```java
package com.szt.supplychain.bms.client.api;

import com.szt.supplychain.bms.model.dto.ApBillPageRespDTO;
import com.szt.supplychain.bms.model.dto.ApBillQueryReqDTO;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "tmall-bms-service", path = "/api/bms/ap-bill")
public interface ApBillRemoteService {

    /**
     * 分页查询应付账单。
     *
     * @param reqDTO 查询条件
     * @return 应付账单分页数据
     */
    @PostMapping("/page")
    ApBillPageRespDTO page(@RequestBody(required = false) ApBillQueryReqDTO reqDTO);
}
```

#### Step 6：Controller 层（web 模块）

Controller 中的每个 API 方法必须使用标准多行 JavaDoc，说明接口用途、`@param` 参数含义与 `@return` 返回内容；无返回值接口也必须说明接口用途和入参含义。

```java
package com.szt.supplychain.bms.web.controller;

import com.szt.supplychain.bms.biz.service.ApBillService;
import com.szt.supplychain.bms.client.api.ApBillRemoteService;
import com.szt.supplychain.bms.model.dto.ApBillPageRespDTO;
import com.szt.supplychain.bms.model.dto.ApBillQueryReqDTO;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.annotation.Resource;

/**
 * 应付账单管理
 */
@RestController
@RequestMapping("/api/bms/ap-bill")
public class ApBillController implements ApBillRemoteService {

    @Resource
    private ApBillService apBillService;

    /**
     * 分页查询应付账单。
     *
     * @param reqDTO 查询条件
     * @return 应付账单分页数据
     */
    @Override
    @PostMapping("/page")
    public ApBillPageRespDTO page(@RequestBody(required = false) ApBillQueryReqDTO reqDTO) {
        return apBillService.page(reqDTO);
    }
}
```

---

### 6.5 写操作规范

#### 6.5.1 事务注解

所有写操作必须加 `@Transactional(rollbackFor = Exception.class)`：

```java
@Override
@Transactional(rollbackFor = Exception.class)
public Boolean confirm(ArBillActionReqDTO reqDTO) {
    for (String billNo : billNos(reqDTO)) {
        arBillMapper.updateStatusByBillNo(billNo, "CONFIRMED", operator(reqDTO));
    }
    return true;
}
```

#### 6.5.2 参数校验

在 Service 层入口做参数校验，业务校验失败统一抛出 `BusinessException`（import `com.szt.framework.core.exceptions.BusinessException`，完整示例见 3.3 节）：

```java
@Override
@Transactional(rollbackFor = Exception.class)
public Boolean manualFee(ArBillManualFeeSaveReqDTO reqDTO) {
    if (reqDTO == null || !hasText(reqDTO.getBillNo())) {
        throw new BusinessException("500", "账单编号不能为空");
    }
    if (!hasText(reqDTO.getFeeCode()) || !hasText(reqDTO.getFeeName())) {
        throw new BusinessException("500", "费项编码和费项名称不能为空");
    }
    if (!hasText(reqDTO.getReason())) {
        throw new BusinessException("500", "补录原因不能为空");
    }
    // ...
}
```

#### 6.5.3 并发控制（SELECT ... FOR UPDATE）

涉及金额更新的写操作，必须先加行锁：

```java
private ArBill requireBillForUpdate(String billNo) {
    ArBill bill = arBillMapper.selectByBillNoForUpdate(billNo);
    if (bill == null) {
        throw new BusinessException("500", "账单不存在：" + billNo);
    }
    return bill;
}
```

对应 Mapper：

```java
/**
 * 根据账单编号查询应收账单并加行锁。
 *
 * @param billNo 账单编号
 * @return 已锁定的应收账单；不存在时返回 {@code null}
 */
@SelectProvider(type = ArBillSqlProvider.class, method = "selectByBillNoForUpdate")
ArBill selectByBillNoForUpdate(@Param("billNo") String billNo);

/**
 * 构建根据账单编号查询并加行锁的 SQL。
 *
 * @return 行锁查询 SQL
 */
public String selectByBillNoForUpdate() {
    return "SELECT " + baseColumns() + " FROM ar_bill WHERE bill_no = #{billNo} AND is_deleted = 0 FOR UPDATE";
}
```

#### 6.5.4 乐观锁 / 状态校验

操作前校验状态：

```java
private void validatePaymentStatus(List<ArBill> bills) {
    for (ArBill bill : bills) {
        String status = bill.getBillStatus();
        if (!"CONFIRMED".equals(status) && !"PART_PAID".equals(status)) {
            throw new BusinessException("500", "账单未复核，不能登记收款：" + bill.getBillNo());
        }
    }
}
```

---

### 6.6 金额处理规范

#### 6.6.1 统一使用 BigDecimal

```java
// 正确：使用 BigDecimal
private BigDecimal defaultAmount(BigDecimal amount) {
    return amount == null ? BigDecimal.ZERO : amount;
}

// 正确：精度控制（4位小数）
amountBill = amountFeeCurrency.multiply(exchangeRateToBill).setScale(4, RoundingMode.HALF_UP);

// 错误：使用 double / float 做金额计算
// double total = 100.0 * 0.17;
```

#### 6.6.2 金额运算取正值

```java
private BigDecimal positiveAmount(BigDecimal amount) {
    BigDecimal value = defaultAmount(amount);
    return value.compareTo(BigDecimal.ZERO) < 0 ? value.negate() : value;
}
```

#### 6.6.3 数据库金额字段定义

```sql
DECIMAL(18,4) NOT NULL DEFAULT 0 COMMENT '应收金额'
```

- 精度 18 位，小数 4 位
- 不允许 NULL，默认值 0

---

### 6.7 枚举使用规范

#### 6.7.1 枚举定义

```java
public enum BillConfigTypeEnum {
    DEFAULT("DEFAULT", "默认配置"),
    BRANCH("BRANCH", "分支配置");

    private final String code;
    private final String desc;

    BillConfigTypeEnum(String code, String desc) {
        this.code = code;
        this.desc = desc;
    }

    public String getCode() { return code; }
    public String getDesc() { return desc; }
}
```

#### 6.7.2 枚举在代码中使用

```java
// 正确：使用枚举 code 常量
if ("CONFIRMED".equals(bill.getBillStatus())) { ... }
if (!"PAID".equals(bill.getBillStatus())) { ... }

// 状态流转：
// GENERATED → CONFIRMED → PART_PAID / PAID
```

**注意**：现有代码中状态值使用字符串常量而非枚举引用。新开发推荐将状态提取为枚举常量类；每个常量必须使用标准多行 JavaDoc 说明其业务含义和适用状态：

```java
/**
 * BMS 业务状态与币种常量。
 */
public class BmsConstants {
    /**
     * 已生成的账单状态，账单尚未确认。
     */
    public static final String BILL_STATUS_GENERATED = "GENERATED";

    /**
     * 已确认的账单状态，允许后续收款或核销处理。
     */
    public static final String BILL_STATUS_CONFIRMED = "CONFIRMED";

    /**
     * 已全额支付的账单状态。
     */
    public static final String BILL_STATUS_PAID = "PAID";

    /**
     * 已部分支付的账单状态。
     */
    public static final String BILL_STATUS_PART_PAID = "PART_PAID";

    /**
     * 正常有效的核销状态。
     */
    public static final String WRITEOFF_STATUS_NORMAL = "NORMAL";

    /**
     * 已冲销的核销状态。
     */
    public static final String WRITEOFF_STATUS_REVERSED = "REVERSED";

    /**
     * 人民币币种代码。
     */
    public static final String CURRENCY_CNY = "CNY";
}
```

---

### 6.8 Feign 远程调用规范

#### 6.8.1 定义契约（client 模块）

Client 契约中的每个 API 方法必须使用标准多行 JavaDoc，说明接口用途、`@param` 参数含义与 `@return` 返回内容。

```java
@FeignClient(name = "tmall-bms-service", path = "/api/bms/ar-bill")
public interface ArBillRemoteService {
    /**
     * 分页查询应收账单。
     *
     * @param reqDTO 查询条件
     * @return 应收账单分页数据
     */
    @PostMapping("/page")
    ArBillPageRespDTO page(@RequestBody(required = false) ArBillQueryReqDTO reqDTO);
}
```

#### 6.8.2 Controller 实现契约

```java
@RestController
@RequestMapping("/api/bms/ar-bill")
public class ArBillController implements ArBillRemoteService {
    // 方法签名必须与 Feign 接口完全一致
}
```

#### 6.8.3 消费方引用（在其他服务的 Starter 类上）

```java
@EnableFeignClients(basePackages = {
    "com.szt.supplychain.bms.client",   // BMS 的 client 包
    "com.szt.supplychain.store.api.client"
})
```

---

### 6.9 前端对接规范（admin-front）

#### 6.9.1 API 文件

API 调用必须放在 `src/api/` 目录下，使用 `@/utils/request`：

```typescript
// src/api/bms/arBill.ts
import request from '@/utils/request'

/** 应收账单分页查询 */
export function arBillPage(data: any) {
  return request({
    url: '/api/bms/ar-bill/page',
    method: 'post',
    data
  })
}

/** 应收账单详情 */
export function arBillDetail(billNo: string) {
  return request({
    url: '/api/bms/ar-bill/detail',
    method: 'get',
    params: { billNo }
  })
}

/** 应收账单确认 */
export function arBillConfirm(data: any) {
  return request({
    url: '/api/bms/ar-bill/confirm',
    method: 'post',
    data
  })
}
```

#### 6.9.2 API 基础 URL

**不要硬编码 URL**。API 基础 URL 由 `src/utils/setUrl.ts` 根据 `location.port` 自动判断：

```typescript
// src/utils/setUrl.ts — 禁止修改或绕过此配置
```

#### 6.9.3 路由配置

新页面路由必须在 `src/router/index.ts` 的 `baseRoutes.children` 中定义，且 `meta.code` 必须与后端菜单权限码一致：

```typescript
{
  path: '/bms/ar-bill',
  name: 'ArBillPage',
  component: () => import('@/views/bms/ar-bill/index.vue'),
  meta: {
    title: '应收账单',
    code: 'bms:arBill:view'  // 必须与后端权限码一致
  }
}
```

---

## 7 业务流程设计文档同步规范

### 7.1 为什么要同步设计文档

BMS 系统的业务流程涉及多方协作（供应链、店铺、财务、仓储），流程设计一旦调整，代码实现必须同步跟进，而设计文档是开发、测试、产品之间唯一可靠的"真相来源"。如果文档滞后于代码，会导致：

- 新人接手时无法理解业务全貌
- AI 辅助开发时缺乏上下文，产出偏离业务意图
- 前后端对接口行为理解不一致
- 回归测试缺少预期的流程基线

### 7.2 设计文档目录结构

`aidocs/bms/design/` 目录下维护了 BMS 系统所有业务模块的流程设计文档，结构如下：

```
aidocs/bms/design/
├── PRD.md                                          # 产品需求总纲
├── bms-ar-bill-detail-page-design.md               # 应收账单详情页设计
├── bms-bill-generate-code-design.md                 # 账单生成代码设计
├── bms-bill-generate-task-monitor-design.md          # 账单生成任务监控设计
├── bms-bill-generation-design.md                    # 账单生成流程设计
├── bms-bill-writeoff-design.md                      # 账单核销流程设计
├── bms-consolidation-billing-design.md               # 集运计费设计
├── bms-consolidation-billing-prd.md                  # 集运计费 PRD
├── bms-fee-source-dataset-design.md                  # 费项数据源设计
├── bms-multi-currency-billing-design.md              # 多币种计费设计
└── uml/                                              # PlantUML 流程图
    ├── primary/                                      # 核心业务流程图
    │   ├── 应收账单状态机.md                          # 账单状态流转
    │   ├── 业财一体流程图.md                           # 业务财务一体化流程
    │   ├── 费项支付方式.md                             # 费项与支付方式关系
    │   └── 账期甘特图.md                               # 账期时间线规划
    └── secondary/                                    # 辅助流程图
        ├── 系统核心对象关系图.md                       # 核心实体 ER 关系
        ├── 跨境集运全链路费项分解.md                    # 费项计算全链路
        ├── 目的国配置.md                               # 目的国参数配置
        ├── 线路计费核心配置.md                         # 计费规则配置
        ├── 订单费用报表财务字段.md                      # 报表财务字段映射
        └── COD包裹货款代收流程.md                      # COD 代收货款流程
```

### 7.3 各文档用途速查

| 文档 | 用途 | 何时查阅 |
|------|------|----------|
| `PRD.md` | 产品需求总纲，全局业务概述 | 理解系统整体目标时 |
| `bms-ar-bill-detail-page-design.md` | 应收账单详情页：字段、操作、状态流转规则 | 开发账单详情页或修改账单操作逻辑时 |
| `bms-bill-generation-design.md` | 账单生成全流程：触发条件、计算逻辑、异常处理 | 开发/修改账单生成功能时 |
| `bms-bill-generate-code-design.md` | 账单生成的代码级设计：类图、方法调用链、时序 | 编码实现账单生成时 |
| `bms-bill-generate-task-monitor-design.md` | 生成任务监控：任务状态、重试机制、告警 | 开发任务监控面板或定时任务时 |
| `bms-bill-writeoff-design.md` | 核销流程：收款登记、核销分配、反核销 | 开发/修改收款核销功能时 |
| `bms-consolidation-billing-design.md` | 集运计费完整设计：费用项、计算公式、汇率 | 开发集运费用计算逻辑时 |
| `bms-consolidation-billing-prd.md` | 集运计费 PRD：产品视角的计费规则 | 理解计费产品需求时 |
| `bms-fee-source-dataset-design.md` | 费项数据源：外部系统数据同步、字段映射 | 开发/修改外部数据对接时 |
| `bms-multi-currency-billing-design.md` | 多币种计费：币种转换、汇率快照、金额重算 | 开发/修改多币种相关功能时 |
| `uml/primary/应收账单状态机.md` | 应收账单状态机图：GENERATED→CONFIRMED→PAID 等 | 判断状态流转条件、新增状态时 |
| `uml/primary/业财一体流程图.md` | 业务与财务数据联动：订单→账单→核销全流程 | 理解端到端数据流时 |
| `uml/primary/费项支付方式.md` | 费项类型与支付方式的对应关系 | 确定费项如何影响核销时 |
| `uml/primary/账期甘特图.md` | 账期时间线：生成、发送、逾期、结算的时间窗口 | 开发账期相关判断逻辑时 |
| `uml/secondary/系统核心对象关系图.md` | 核心实体（账单、费项、订单、收款）的 ER 关系 | 理解表间关联、JOIN 关系时 |
| `uml/secondary/跨境集运全链路费项分解.md` | 跨境物流全链路费项的计算和分摊 | 开发跨境费项时 |
| `uml/secondary/目的国配置.md` | 目的国相关参数配置设计 | 开发目的地配置时 |
| `uml/secondary/线路计费核心配置.md` | 计费规则核心配置（结算条款、费率） | 开发结算条款配置时 |
| `uml/secondary/订单费用报表财务字段.md` | 报表中财务字段的映射规则 | 开发报表导出时 |
| `uml/secondary/COD包裹货款代收流程.md` | COD（货到付款）代收货款流程 | 开发 COD 费项时 |

### 7.4 同步规则

**强制规则：当业务流程设计发生调整时，必须同步更新对应的设计文档。**

具体场景：

| 场景 | 必须更新的文档 | 示例 |
|------|----------------|------|
| 新增业务状态流转 | `uml/primary/应收账单状态机.md` + 对应模块设计文档 | 新增"部分核销"状态 |
| 修改费项计算逻辑 | `bms-consolidation-billing-design.md` + `bms-multi-currency-billing-design.md` | 调整汇率重算规则 |
| 修改核销流程 | `bms-bill-writeoff-design.md` + `uml/primary/业财一体流程图.md` | 新增批量核销 |
| 新增外部数据源 | `bms-fee-source-dataset-design.md` | 接入新的物流系统数据 |
| 修改账单生成触发条件 | `bms-bill-generation-design.md` + `bms-bill-generate-code-design.md` | 修改定时任务调度规则 |
| 新增核心实体或修改关联关系 | `uml/secondary/系统核心对象关系图.md` | 新增费用调整单表 |
| 修改产品需求 | `PRD.md` + 对应模块设计文档 | 调整账期规则 |

### 7.5 文档更新模板

更新设计文档时，在文档头部增加变更记录：

```markdown
## 变更记录

| 日期 | 变更人 | 变更内容 | 关联 PR/Issue |
|------|--------|----------|---------------|
| 2026-05-30 | xxx | 新增部分核销状态流转规则 | #123 |
```

### 7.6 AI 辅助开发时的设计文档检索

在进行 BMS 开发时，AI 应根据当前开发的业务模块主动检索对应的设计文档：

| 开发模块 | AI 应主动检索的文档 |
|----------|---------------------|
| 应收账单（ArBill） | `bms-ar-bill-detail-page-design.md`, `uml/primary/应收账单状态机.md` |
| 核销（Payment/Writeoff） | `bms-bill-writeoff-design.md`, `uml/primary/费项支付方式.md` |
| 账单生成（BillGenerate） | `bms-bill-generation-design.md`, `bms-bill-generate-code-design.md`, `bms-bill-generate-task-monitor-design.md` |
| 费项（FeeDetail/FeeIndex） | `bms-consolidation-billing-design.md`, `bms-fee-source-dataset-design.md` |
| 多币种/汇率 | `bms-multi-currency-billing-design.md` |
| 结算条款（SettlementTerms） | `bms-consolidation-billing-prd.md`, `uml/secondary/线路计费核心配置.md` |
| 集运订单（MainOrder） | `uml/secondary/跨境集运全链路费项分解.md`, `uml/secondary/系统核心对象关系图.md` |
| 调账（FeeAdjustment） | `bms-ar-bill-detail-page-design.md`, `uml/primary/应收账单状态机.md` |
| 报表导出 | `uml/secondary/订单费用报表财务字段.md` |
| 全局/跨模块 | `PRD.md`, `uml/primary/业财一体流程图.md` |

### 7.7 大需求先出落地方案再编码

当判断本次需求较大时，必须先充分考虑当前业务场景，结合现有代码输出需求落地方案、调整计划与疑问点，不能直接进入编码。

**大需求判定**（满足任意一条即视为大需求）：

- 新增业务模块或跨模块改造，前后端同时调整
- 涉及多张表结构变更、数据迁移或存量数据口径调整
- 涉及金额、汇率、状态机、核销、账期等核心业务口径
- 存在无法直接确定的业务口径，需要产品、财务或外部系统确认
- 改动面广、回归风险高

**必选动作**：

1. 充分梳理当前业务场景：需求/PRD、`aidocs/bms/design/` 设计文档、`aidocs/technical-caliber/bms/dev-specs/` 已有方案、现有代码和数据库表结构。
2. 在 `aidocs/technical-caliber/bms/dev-specs/` 目录新建方案文档，文件名为 `yyyy-MM-dd-bms-{模块}-{需求名}需求落地方案及调整计划.md`，日期取当天，例如 `2026-08-19-bms-xxx需求落地方案及调整计划.md`。
3. 方案必须包含以下内容：
   - **需求背景与目标边界**：说明本次要解决什么、不做什么
   - **业务场景与口径**：梳理涉及的供应链、店铺、财务、仓储等业务场景
   - **现状分析**：基于现有代码、表结构、接口和设计文档，列出现状与目标差距
   - **落地方案**：明确后端、前端、数据库、接口等具体改动点
   - **调整计划**：分阶段任务、依赖关系、验证与验收方式
   - **疑问点**：列出无法直接确认的业务口径，给出候选方案和推荐默认值，等待确认
4. 落地方案与疑问点确认前，不得直接进入大规模编码；简单、小范围需求可不强制。

**完成判定**：大需求只有落地方案文档已创建、现状分析基于真实代码与库表、疑问点有明确确认口径后，才允许进入编码阶段。

---

## 8 检查清单

新模块开发完成时，逐项确认：

| 序号 | 检查项 | 状态 |
|------|--------|------|
| 1 | 实体类字段有 JavaDoc 注释 | ☐ |
| 2 | DTO 字段有 JavaDoc 注释 | ☐ |
| 3 | 请求数据隔离三字段 `scId`/`shopId`/`userId` | ☐ |
| 4 | 写操作 `@Transactional(rollbackFor = Exception.class)` | ☐ |
| 5 | 金额字段 `BigDecimal`，数据库 `DECIMAL(18,4)` | ☐ |
| 6 | 分页 DTO 含 `getOffset()`/`getLimit()`，上限 200 | ☐ |
| 7 | Service 入参 null 防御 | ☐ |
| 8 | SQL 动态条件写在 XML `<if>` 标签中，禁止 SqlProvider 拼串 | ☐ |
| 9 | XML 中数据隔离条件在 WHERE 最前面 | ☐ |
| 10 | XML 使用 `<sql>` + `<include>` 复用列和条件片段 | ☐ |
| 11 | XML 使用 `<resultMap>` 显式映射，不用 `resultType` 自动映射 | ☐ |
| 12 | INSERT 使用 `useGeneratedKeys` 回写主键 | ☐ |
| 13 | Controller 实现 Feign 契约接口 | ☐ |
| 14 | Controller 写操作 POST + RequestBody | ☐ |
| 15 | URL kebab-case `/api/bms/xxx-yyy` | ☐ |
| 16 | 逻辑删除 `is_deleted = 0` 条件 | ☐ |
| 17 | 状态常量提取到 `BmsConstants` | ☐ |
| 18 | Feign Client `@FeignClient(name="tmall-bms-service")` | ☐ |
| 19 | 前端 API 放 `src/api/`，用 `request` 封装 | ☐ |
| 20 | 前端路由 `meta.code` 与后端权限码一致 | ☐ |
| 21 | 无 Map 作为返回类型或参数 | ☐ |
| 22 | 无 SQL 函数作用在 WHERE 列上 | ☐ |
| 23 | 业务流程变更已同步到 `aidocs/bms/design/` 对应文档 | ☐ |
| 24 | 涉及库表结构变更时，已将完整最新表结构同步到 `aidocs/technical-caliber/sql/ar_bill.sql` | ☐ |
| 25 | 业务校验失败统一抛出 `BusinessException(code, message)`，禁止 `IllegalArgumentException` | ☐ |
| 26 | 核心业务逻辑关键行/分支有简明 `//` 行内注释，无步骤编号式注释 | ☐ |
| 27 | 大需求已在 `aidocs/technical-caliber/bms/dev-specs/` 输出日期开头的落地方案，含调整计划与疑问点 | ☐ |
