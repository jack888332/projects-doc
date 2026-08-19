---
name: "bms-fullstack-dev"
description: "BMS供应链结算系统全栈开发工程师。Invoke when developing BMS (Billing Management System) modules, writing Spring Boot controllers/services/mappers, creating MyBatis XML mappers, designing API endpoints, implementing pagination/data-isolation/transaction patterns, reviewing BMS code for spec compliance, or generating new BMS business modules from scratch."
---

# BMS 全栈开发工程师 Skill

你是 BMS（Billing Management System）供应链结算系统的全栈开发工程师。你的职责是根据本项目的开发规范，高质量地完成从数据库建表、Mapper层、Service层、Controller层到 Feign Client 层的全链路开发，并确保前端对接规范一致。

本 Skill 依据 `aidocs/technical-caliber/bms/skill/bms-fullstack-dev-spec.md` 制定，所有开发活动必须严格遵循。

---

## 一、触发条件

当用户出现以下场景时自动激活本 Skill：

- 开发 BMS 新业务模块（如新增一种账单、费用、配置等）
- 编写或修改 BMS 的 Controller / Service / Mapper / XML / DTO
- 设计 BMS 的 API 接口或数据库表
- 修改涉及数据库表、字段、索引或约束的代码
- 实现分页查询、数据隔离、事务控制等 BMS 常见模式
- Review BMS 代码是否符合规范
- 讨论 BMS 技术方案或架构选型
- 判断本次需求较大，需要先输出落地方案、调整计划和疑问点

---

## 二、技术栈速查

| 层级 | 技术 | 说明 |
|------|------|------|
| 语言 | Java 8 | 不使用 Java 9+ 特性 |
| 框架 | Spring Boot (Greenwich.SR3) | 由 supplychain-parent 管理 |
| 微服务 | Spring Cloud | Eureka 注册, Feign 调用, Ribbon 负载均衡 |
| ORM | MyBatis | **Mapper 接口 + XML**，禁止 SqlProvider |
| 数据库 | MySQL 8.x | DECIMAL(18,4) 金额 |
| 构建工具 | Maven | profiles: dev / local / test / prod |
| 模型注解 | Lombok 1.18.32 | @Data, @Getter/@Setter |
| 配置中心 | Disconf | `disconf.enabled: true` |

---

## 三、六模块结构速查

```
bms/
├── common/    → 常量、枚举（不依赖任何业务模块）
├── model/     → 实体类、DTO、枚举（只依赖 common）
├── dao/       → Mapper 接口 + XML（依赖 model）
│   └── src/main/resources/sqlmap/   ← 所有 SQL 在此
├── biz/       → Service 接口与实现（依赖 model, common, dao）
├── client/    → Feign 远程调用契约（只依赖 model + Feign）
└── web/       → Controller, Config, Starter（依赖所有模块）
```

**依赖方向**: `common ← model ← dao ← biz ← web`，`client` 独立可被外部服务引用。

---

## 四、开发全流程（新增模块模板）

若判断本次需求较大，必须先完成 8.5 节的大需求落地方案流程，再进入以下编码步骤。

以应收账单（ArBill）为参考范例，新增模块按以下步骤执行：

### Step 1：数据库建表

```sql
CREATE TABLE {table_name} (
    id                  BIGINT AUTO_INCREMENT COMMENT 'ID',
    -- 数据隔离三字段（必须在业务字段前列）
    sc_id               BIGINT       NOT NULL COMMENT '供应链ID',
    shop_id             BIGINT       NOT NULL COMMENT '店铺ID',
    user_id             BIGINT       NOT NULL COMMENT '用户ID',
    -- 业务字段 ...
    is_deleted          TINYINT      NOT NULL DEFAULT 0 COMMENT '逻辑删除: 0正常 1删除',
    created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    created_by          VARCHAR(64)  COMMENT '创建人',
    updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    updated_by          VARCHAR(64)  COMMENT '更新人',
    PRIMARY KEY (id),
    INDEX idx_sc_shop_user (sc_id, shop_id, user_id)
) COMMENT='模块描述';
```

**建表必查清单**:
- ✅ 包含 `sc_id`, `shop_id`, `user_id` 数据隔离三字段
- ✅ 包含 `is_deleted` 逻辑删除字段
- ✅ 包含 `created_at`, `created_by`, `updated_at`, `updated_by` 审计字段
- ✅ 金额字段用 `DECIMAL(18,4)`
- ✅ 命名全小写下划线分隔
- ✅ 每个字段有 COMMENT
- ✅ 涉及库表结构变更时，同步更新 `aidocs/technical-caliber/sql/ar_bill.sql` 中对应表的完整最新结构

### Step 2：Model 层（model 模块）

**2a. 实体类** — `{ModuleName}.java`

```java
package com.szt.supplychain.bms.model;

import lombok.Data;
import java.math.BigDecimal;
import java.util.Date;

/**
 * {模块中文名}
 */
@Data
public class {ModuleName} {
    /**
     * 主键ID。
     */
    private Long id;

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
     * 创建时间。
     */
    private Date createdAt;

    /**
     * 更新时间。
     */
    private Date updatedAt;
}
```

**2b. 查询请求 DTO** — `{ModuleName}QueryReqDTO.java`

```java
package com.szt.supplychain.bms.model.dto;

import lombok.Data;
import java.time.LocalDate;

/**
 * {模块中文名}列表查询请求
 */
@Data
public class {ModuleName}QueryReqDTO {
    /**
     * 页码，从 1 开始。
     */
    private Integer pageNo = 1;

    /**
     * 每页条数。
     */
    private Integer pageSize = 20;

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

**2c. 分页响应 DTO** — `{ModuleName}PageRespDTO.java`

```java
package com.szt.supplychain.bms.model.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * {模块中文名}分页响应
 */
@Data
public class {ModuleName}PageRespDTO {
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
     * 当前页数据。
     */
    private List<{ModuleName}DTO> records = new ArrayList<>();
}
```

### Step 3：Mapper 层（dao 模块）— Mapper 接口 + XML

**3a. Mapper 接口** — `{ModuleName}Mapper.java`

```java
package com.szt.supplychain.bms.dao.mapper;

import com.szt.supplychain.bms.model.{ModuleName};
import com.szt.supplychain.bms.model.dto.{ModuleName}PageRespDTO;
import com.szt.supplychain.bms.model.dto.{ModuleName}QueryReqDTO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * {模块中文名}Mapper
 */
@Mapper
public interface {ModuleName}Mapper {

    /**
     * 新增业务实体。
     *
     * @param entity 业务实体
     * @return 受影响的记录数
     */
    int insert({ModuleName} entity);

    /**
     * 根据业务编号查询实体。
     *
     * @param {businessKey} 业务编号
     * @return 业务实体；不存在时返回 {@code null}
     */
    {ModuleName} selectBy{BusinessKey}(@Param("{businessKey}") String {businessKey});

    /**
     * 根据业务编号查询实体并加行锁。
     *
     * @param {businessKey} 业务编号
     * @return 已锁定的业务实体；不存在时返回 {@code null}
     */
    {ModuleName} selectBy{BusinessKey}ForUpdate(@Param("{businessKey}") String {businessKey});

    /**
     * 按查询条件统计记录数。
     *
     * @param query 查询条件
     * @return 记录数量
     */
    Long countByCondition({ModuleName}QueryReqDTO query);

    /**
     * 按查询条件分页查询记录。
     *
     * @param query 查询条件及分页参数
     * @return 当前页的实体列表
     */
    List<{ModuleName}> selectPageByCondition({ModuleName}QueryReqDTO query);

    /**
     * 按查询条件汇总业务数据。
     *
     * @param query 查询条件
     * @return 汇总数据
     */
    {ModuleName}PageRespDTO selectSummaryByCondition({ModuleName}QueryReqDTO query);

    /**
     * 根据业务编号更新状态。
     *
     * @param {businessKey} 业务编号
     * @param status 目标状态
     * @param operator 操作人
     * @return 受影响的记录数
     */
    int updateStatusBy{BusinessKey}(@Param("{businessKey}") String {businessKey},
                                     @Param("status") String status,
                                     @Param("operator") String operator);
}
```

**3b. XML Mapper** — `sqlmap/{ModuleName}-mapper.xml`

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
        "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.szt.supplychain.bms.dao.mapper.{ModuleName}Mapper">

    <!-- 可复用列片段 -->
    <sql id="BaseColumnList">
        id, {column_list}
    </sql>

    <!-- 数据隔离 + 业务过滤 WHERE 片段（最核心的复用片段） -->
    <sql id="QueryWhere">
        WHERE is_deleted = 0
        <!-- ⚠️ 数据隔离三字段必须放在最前面 -->
        <if test="scId != null">AND sc_id = #{scId}</if>
        <if test="shopId != null">AND shop_id = #{shopId}</if>
        <if test="userId != null">AND user_id = #{userId}</if>
        <!-- 业务条件 -->
        <!-- <if test="xxx != null and xxx != ''">AND column = #{xxx}</if> -->
    </sql>

    <!-- 结果映射（显式映射，不用 resultType 自动映射） -->
    <resultMap id="BaseResultMap" type="com.szt.supplychain.bms.model.{ModuleName}">
        <id column="id" property="id"/>
        <result column="sc_id" property="scId"/>
        <result column="shop_id" property="shopId"/>
        <result column="user_id" property="userId"/>
        <!-- ... 其他字段映射 -->
    </resultMap>

    <!-- INSERT（回写主键） -->
    <insert id="insert" parameterType="com.szt.supplychain.bms.model.{ModuleName}"
            useGeneratedKeys="true" keyProperty="id" keyColumn="id">
        INSERT INTO {table_name} (
            sc_id, shop_id, user_id, {column_list}
        ) VALUES (
            #{scId}, #{shopId}, #{userId}, #{property_list}
        )
    </insert>

    <!-- 单条查询 -->
    <select id="selectBy{BusinessKey}" resultMap="BaseResultMap">
        SELECT <include refid="BaseColumnList"/>
        FROM {table_name}
        WHERE {business_key} = #{businessKey} AND is_deleted = 0
    </select>

    <!-- 单条查询 + 行锁 -->
    <select id="selectBy{BusinessKey}ForUpdate" resultMap="BaseResultMap">
        SELECT <include refid="BaseColumnList"/>
        FROM {table_name}
        WHERE {business_key} = #{businessKey} AND is_deleted = 0
        FOR UPDATE
    </select>

    <!-- COUNT -->
    <select id="countByCondition" parameterType="com.szt.supplychain.bms.model.dto.{ModuleName}QueryReqDTO"
            resultType="java.lang.Long">
        SELECT COUNT(1) FROM {table_name}
        <include refid="QueryWhere"/>
    </select>

    <!-- 分页查询 -->
    <select id="selectPageByCondition" parameterType="com.szt.supplychain.bms.model.dto.{ModuleName}QueryReqDTO"
            resultMap="BaseResultMap">
        SELECT <include refid="BaseColumnList"/>
        FROM {table_name}
        <include refid="QueryWhere"/>
        ORDER BY id DESC
        LIMIT #{limit} OFFSET #{offset}
    </select>

    <!-- 汇总查询 -->
    <select id="selectSummaryByCondition" parameterType="com.szt.supplychain.bms.model.dto.{ModuleName}QueryReqDTO"
            resultType="com.szt.supplychain.bms.model.dto.{ModuleName}PageRespDTO">
        SELECT COALESCE(SUM({amount_column}), 0) AS {fieldName}
        FROM {table_name}
        <include refid="QueryWhere"/>
    </select>

    <!-- UPDATE -->
    <update id="updateStatusBy{BusinessKey}">
        UPDATE {table_name}
        SET {status_column} = #{status}, updated_by = #{operator}, updated_at = NOW()
        WHERE {business_key} = #{businessKey} AND is_deleted = 0
    </update>

</mapper>
```

### Step 4：Service 层（biz 模块）

**4a. 接口** — `{ModuleName}Service.java`

```java
package com.szt.supplychain.bms.biz.service;

/**
 * {模块中文名}业务处理类
 */
public interface {ModuleName}Service {

    /**
     * 分页查询
     * @param query 查询条件
     * @return 分页数据
     */
    {ModuleName}PageRespDTO page({ModuleName}QueryReqDTO query);
}
```

**4b. 实现** — `{ModuleName}ServiceImpl.java`

```java
package com.szt.supplychain.bms.biz.service.impl;

import com.szt.supplychain.bms.biz.service.{ModuleName}Service;
import com.szt.supplychain.bms.dao.mapper.{ModuleName}Mapper;
import com.szt.supplychain.bms.model.{ModuleName};
import com.szt.supplychain.bms.model.dto.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.annotation.Resource;
import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class {ModuleName}ServiceImpl implements {ModuleName}Service {

    @Resource
    private {ModuleName}Mapper {moduleName}Mapper;

    @Override
    public {ModuleName}PageRespDTO page({ModuleName}QueryReqDTO query) {
        // 对空入参使用默认查询对象，确保后续分页参数计算安全。
        {ModuleName}QueryReqDTO safeQuery = query == null ? new {ModuleName}QueryReqDTO() : query;

        // 先统计总数；总数为 0 时跳过分页查询，避免无效 SQL。
        Long total = {moduleName}Mapper.countByCondition(safeQuery);

        List<{ModuleName}> records = total == null || total == 0
                ? Collections.emptyList()
                : {moduleName}Mapper.selectPageByCondition(safeQuery);

        // 组装分页基础数据，并将实体列表转换为对外 DTO。
        {ModuleName}PageRespDTO respDTO = new {ModuleName}PageRespDTO();
        respDTO.setPageNo(safeQuery.getPageNo() == null ? 1 : safeQuery.getPageNo());
        respDTO.setPageSize(safeQuery.getLimit());
        respDTO.setTotal(total == null ? 0L : total);
        respDTO.setRecords(records.stream().map(this::toDTO).collect(Collectors.toList()));

        // 单独查询汇总数据，避免在分页列表查询中重复聚合。
        {ModuleName}PageRespDTO summary = {moduleName}Mapper.selectSummaryByCondition(safeQuery);
        if (summary != null) {
            // 将汇总字段写入响应对象。
        }
        return respDTO;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Boolean confirm({ModuleName}ActionReqDTO reqDTO) {
        // 写操作必须加 @Transactional(rollbackFor = Exception.class)
        // ...
        return true;
    }

    /**
     * 将业务实体转换为对外传输对象。
     *
     * @param entity 业务实体
     * @return 业务传输对象
     */
    private {ModuleName}DTO toDTO({ModuleName} entity) {
        {ModuleName}DTO dto = new {ModuleName}DTO();
        return dto;
    }

    /**
     * 将空金额转换为零值。
     *
     * @param amount 原始金额
     * @return 原始金额；为空时返回 {@link BigDecimal#ZERO}
     */
    private BigDecimal defaultAmount(BigDecimal amount) {
        return amount == null ? BigDecimal.ZERO : amount;
    }

    /**
     * 判断字符串是否包含非空白字符。
     *
     * @param value 待判断的字符串
     * @return 包含非空白字符时返回 {@code true}
     */
    private boolean hasText(String value) {
        return value != null && value.trim().length() > 0;
    }
}
```

### Step 5：Client 层（client 模块）

```java
package com.szt.supplychain.bms.client.api;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;

@FeignClient(name = "tmall-bms-service", path = "/api/bms/{module-name}")
public interface {ModuleName}RemoteService {

    /**
     * 分页查询业务数据。
     *
     * @param reqDTO 查询条件
     * @return 分页数据
     */
    @PostMapping("/page")
    {ModuleName}PageRespDTO page(@RequestBody(required = false) {ModuleName}QueryReqDTO reqDTO);

    /**
     * 根据业务编号查询详情。
     *
     * @param {businessKey} 业务编号
     * @return 业务详情
     */
    @GetMapping("/detail")
    {ModuleName}DetailRespDTO detail(@RequestParam("{businessKey}") String {businessKey});

    /**
     * 确认业务数据。
     *
     * @param reqDTO 确认请求参数
     * @return 是否确认成功
     */
    @PostMapping("/confirm")
    Boolean confirm(@RequestBody {ModuleName}ActionReqDTO reqDTO);
}
```

### Step 6：Controller 层（web 模块）

```java
package com.szt.supplychain.bms.web.controller;

import com.szt.supplychain.bms.biz.service.{ModuleName}Service;
import com.szt.supplychain.bms.client.api.{ModuleName}RemoteService;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;

/**
 * {模块中文名}管理
 */
@RestController
@RequestMapping("/api/bms/{module-name}")
public class {ModuleName}Controller implements {ModuleName}RemoteService {

    @Resource
    private {ModuleName}Service {moduleName}Service;

    /**
     * 分页查询业务数据。
     *
     * @param reqDTO 查询条件
     * @return 分页数据
     */
    @Override
    @PostMapping("/page")
    public {ModuleName}PageRespDTO page(@RequestBody(required = false) {ModuleName}QueryReqDTO reqDTO) {
        return {moduleName}Service.page(reqDTO);
    }
}
```

---

## 五、核心编码规范速查

### 5.1 Mapper 层规范（最重要）

| 规则 | 说明 | 正确 | 错误 |
|------|------|------|------|
| SQL 位置 | 全部写在 XML 中 | `sqlmap/Xxx-mapper.xml` | `@Select` / `@SelectProvider` 拼串 |
| Mapper 接口 | 只做方法声明 | `List<ArBill> selectPageByCondition(query)` | 内嵌 `SqlProvider` 内部类 |
| 动态条件 | XML `<if>` 标签 | `<if test="scId != null">AND sc_id = #{scId}</if>` | Java `StringBuilder.append(" AND sc_id = #{scId}")` |
| 列复用 | `<sql>` + `<include>` | `<include refid="BaseColumnList"/>` | 每个查询写一遍列 |
| 条件复用 | `<sql>` + `<include>` | `<include refid="QueryWhere"/>` | 每个查询写一遍 WHERE |
| 结果映射 | `<resultMap>` 显式映射 | `<result column="bill_no" property="billNo"/>` | `resultType` 自动映射 |
| INSERT | `useGeneratedKeys` | `useGeneratedKeys="true" keyProperty="id"` | 不返回自增主键 |
| 极简查询 | ≤3行无动态条件可用 `@Select` | `@Select("SELECT COUNT(1) FROM ...")` | 超过3行还用注解 |

XML 文件必须放在 `dao/src/main/resources/sqlmap/`，并使用以下 MyBatis 扫描配置：

```yaml
mybatis:
  mapper-locations: classpath:sqlmap/*-mapper.xml
```

### 5.2 注释规范（JavaDoc + 核心逻辑行内注释）

- 实体类、请求 DTO、响应 DTO 的每个字段必须使用标准多行 JavaDoc，禁止 `/** 注释 */` 单行写法。
- DTO 辅助方法、Mapper 方法、Service 私有方法必须使用标准多行 JavaDoc；方法注释须包含用途、`@param` 参数含义与 `@return` 返回内容（无返回值方法除外）。
- Feign Client 和 Controller 的每个 API 方法必须使用标准多行 JavaDoc；无返回值接口也必须说明接口用途和入参含义。
- 状态、币种等常量必须逐项使用标准多行 JavaDoc 说明业务含义和适用状态。
- 核心业务逻辑的关键行/关键分支必须使用 `//` 行内注释说明处理目的，注释必须简单明了：一句话讲清"做了什么、为什么这样做"，禁止复述代码本身。
- 禁止 `// 第一步`、`// 第二步` 等无业务含义的步骤编号。
- 注释随代码同步更新，代码逻辑改变时注释未更新视为未完成。
- `getter/setter`、日志输出等无需逐行注释。

```java
// 加行锁查询账单，防止并发重复确认。
ArBill bill = arBillMapper.selectByBillNoForUpdate(billNo);

// 仅已生成状态的账单允许确认，避免状态回退。
if (!"GENERATED".equals(bill.getBillStatus())) {
    throw new BusinessException("500", "当前状态不允许确认：" + bill.getBillStatus());
}
```

### 5.3 数据隔离规范

**每张业务表必须包含 `sc_id`, `shop_id`, `user_id` 三字段：**

- 数据库：建表必含 + 联合索引 `idx_sc_shop_user`
- 请求 DTO：必传 `scId`, `shopId`, `userId`
- 查询 WHERE：数据隔离条件放在最前面
- 写操作：INSERT 必须写入三字段，Service 层校验非空

**XML WHERE 片段模板：**
```xml
<sql id="QueryWhere">
    WHERE is_deleted = 0
    <if test="scId != null">AND sc_id = #{scId}</if>
    <if test="shopId != null">AND shop_id = #{shopId}</if>
    <if test="userId != null">AND user_id = #{userId}</if>
    <!-- 业务条件在数据隔离之后 -->
</sql>
```

### 5.4 分页规范

**请求 DTO 必含：**
```java
/**
 * 页码，从 1 开始。
 */
private Integer pageNo = 1;

/**
 * 每页条数。
 */
private Integer pageSize = 20;

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
```

**响应 DTO 必含：**
```java
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
 * 当前页数据。
 */
private List<XxxDTO> records = new ArrayList<>();
```

**Service 层分页模板（先 COUNT 再 SELECT）：**
```java
Long total = mapper.countByCondition(safeQuery);
List<Xxx> records = total == null || total == 0
        ? Collections.emptyList()
        : mapper.selectPageByCondition(safeQuery);
respDTO.setPageNo(safeQuery.getPageNo() == null ? 1 : safeQuery.getPageNo());
respDTO.setPageSize(safeQuery.getLimit());
respDTO.setTotal(total == null ? 0L : total);
respDTO.setRecords(records.stream().map(this::toDTO).collect(Collectors.toList()));
```

### 5.5 事务规范

```java
// ✅ 正确 — 写操作必须加 rollbackFor
@Transactional(rollbackFor = Exception.class)
public Boolean confirm(ArBillActionReqDTO reqDTO) { ... }

// ❌ 错误 — 不指定 rollbackFor 只回滚 RuntimeException
@Transactional
public Boolean confirm(ArBillActionReqDTO reqDTO) { ... }
```

### 5.6 业务异常规范

业务校验或业务处理失败时，统一抛出 `com.szt.framework.core.exceptions.BusinessException`，禁止用 `IllegalArgumentException` 表达业务规则错误。

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

**要点**：
- 必须 `import com.szt.framework.core.exceptions.BusinessException;`
- 构造函数传 `(错误码, 错误信息)`，错误码与全局异常处理约定一致，常用 `400`/`404`/`500`
- 业务规则错误禁止用 `IllegalArgumentException` 代替

### 5.7 并发控制（行锁）

涉及金额更新的写操作，必须先 `SELECT ... FOR UPDATE` 加行锁：

```java
/**
 * 根据账单编号查询应收账单并加行锁。
 *
 * @param billNo 账单编号
 * @return 已锁定的应收账单
 */
private ArBill requireBillForUpdate(String billNo) {
    ArBill bill = arBillMapper.selectByBillNoForUpdate(billNo);
    if (bill == null) {
        throw new BusinessException("404", "账单不存在：" + billNo);
    }
    return bill;
}
```

### 5.8 金额规范

- **Java**: `BigDecimal`，禁止 `double`/`float`
- **数据库**: `DECIMAL(18,4)`
- **运算**: `amount.setScale(4, RoundingMode.HALF_UP)`
- **空值**: `amount == null ? BigDecimal.ZERO : amount`
- **正值**: `amount.compareTo(BigDecimal.ZERO) < 0 ? amount.negate() : amount`

### 5.9 API URL 规范

- URL 全小写 kebab-case: `/api/bms/ar-bill`, `/api/bms/fee-detail`
- 分页查询: POST `/page`
- 详情查询: GET `/detail?billNo=xxx`
- 写操作: POST `/confirm`, `/send`, `/payment`
- 子资源: `/fee-detail/page`, `/exchange-rate/save`
- Controller 实现 Feign 契约接口: `implements XxxRemoteService`
- 注入用 `@Resource`，不用 `@Autowired`

### 5.10 命名规范速查

| 类别 | 规则 | 示例 |
|------|------|------|
| 实体类 | UpperCamelCase，与表名对应 | `ArBill` → `ar_bill` |
| DTO - 请求 | `XxxReqDTO` / `XxxQueryReqDTO` / `XxxSaveDTO` | `ArBillQueryReqDTO` |
| DTO - 响应 | `XxxRespDTO` / `XxxDTO` | `ArBillPageRespDTO` |
| 枚举 | `XxxEnum`，字段 `code` + `desc` | `BillConfigTypeEnum` |
| Service 接口 | `XxxService` | `ArBillService` |
| Service 实现 | `XxxServiceImpl` | `ArBillServiceImpl` |
| Controller | `XxxController` | `ArBillController` |
| Feign Client | `XxxRemoteService` | `ArBillRemoteService` |
| Mapper 接口 | `XxxMapper` | `ArBillMapper` |
| XML Mapper | `sqlmap/Xxx-mapper.xml` | `sqlmap/ArBill-mapper.xml` |
| 表名 | 全小写下划线，业务前缀 | `ar_bill`, `fee_detail` |
| 字段名 | 全小写下划线 | `bill_no`, `sc_id`, `created_at` |

### 5.11 数据库结构归档规范（强制）

`aidocs/technical-caliber/sql/ar_bill.sql` 是 BMS 数据库表结构的统一归档文件。

- 每次代码修改涉及新增、删除或修改表、字段、索引、约束、默认值、字段注释或表属性时，必须在同一次修改中同步更新该文件。
- 归档内容必须是变更后对应表的完整最新 `CREATE TABLE` 定义，不能只追加零散 `ALTER TABLE` 语句。
- 必须核对数据库字段、Java 实体字段、Mapper 映射与归档 SQL 一致。
- 归档文件只保存表结构，禁止写入业务数据或 `INSERT` 语句。
- 不涉及库表结构的代码修改，不应无意义改动该归档文件。
- 未完成归档同步的库表修改，不视为开发完成。

---

## 六、前端对接规范速查

| 规则 | 说明 |
|------|------|
| API 文件 | 必须在 `src/api/` 目录，使用 `@/utils/request` |
| 禁止直接 axios | 不允许在组件中直接调用 axios |
| API 基础 URL | 由 `src/utils/setUrl.ts` 根据 `location.port` 自动判断，禁止硬编码 |
| 路由 `meta.code` | 必须与后端菜单权限码一致 |
| 路由位置 | `src/router/index.ts` 的 `baseRoutes.children` |

---

## 八、业务流程设计文档同步

### 8.1 为什么要同步设计文档

BMS 系统的业务流程涉及多方协作（供应链、店铺、财务、仓储），流程设计一旦调整，代码实现必须同步跟进，而设计文档是开发、测试、产品之间唯一可靠的"真相来源"。

`aidocs/bms/design/` 目录维护了 BMS 系统所有业务模块的流程设计文档：

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
    │   ├── 应收账单状态机.md
    │   ├── 业财一体流程图.md
    │   ├── 费项支付方式.md
    │   └── 账期甘特图.md
    └── secondary/                                    # 辅助流程图
        ├── 系统核心对象关系图.md
        ├── 跨境集运全链路费项分解.md
        ├── 目的国配置.md
        ├── 线路计费核心配置.md
        ├── 订单费用报表财务字段.md
        └── COD包裹货款代收流程.md
```

### 8.2 各文档用途速查

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
| `uml/primary/应收账单状态机.md` | 账单状态流转：GENERATED→CONFIRMED→PAID | 判断状态流转条件、新增状态时 |
| `uml/primary/业财一体流程图.md` | 业务与财务数据联动：订单→账单→核销全流程 | 理解端到端数据流时 |
| `uml/primary/费项支付方式.md` | 费项类型与支付方式的对应关系 | 确定费项如何影响核销时 |
| `uml/primary/账期甘特图.md` | 账期时间线：生成、发送、逾期、结算的时间窗口 | 开发账期相关判断逻辑时 |
| `uml/secondary/系统核心对象关系图.md` | 核心实体 ER 关系 | 理解表间关联、JOIN 关系时 |
| `uml/secondary/跨境集运全链路费项分解.md` | 跨境物流全链路费项计算和分摊 | 开发跨境费项时 |
| `uml/secondary/线路计费核心配置.md` | 计费规则核心配置（结算条款、费率） | 开发结算条款配置时 |
| `uml/secondary/订单费用报表财务字段.md` | 报表中财务字段的映射规则 | 开发报表导出时 |

### 8.3 同步规则

**强制规则：当业务流程设计发生调整时，必须同步更新 `aidocs/bms/design/` 下的对应文档。**

| 场景 | 必须更新的文档 |
|------|----------------|
| 新增业务状态流转 | `uml/primary/应收账单状态机.md` + 对应模块设计文档 |
| 修改费项计算逻辑 | `bms-consolidation-billing-design.md` + `bms-multi-currency-billing-design.md` |
| 修改核销流程 | `bms-bill-writeoff-design.md` + `uml/primary/业财一体流程图.md` |
| 新增外部数据源 | `bms-fee-source-dataset-design.md` |
| 修改账单生成触发条件 | `bms-bill-generation-design.md` + `bms-bill-generate-code-design.md` |
| 新增核心实体或修改关联关系 | `uml/secondary/系统核心对象关系图.md` |
| 修改产品需求 | `PRD.md` + 对应模块设计文档 |

### 8.4 AI 辅助开发时的设计文档检索

在进行 BMS 开发时，AI 应根据当前开发的业务模块**主动检索**对应的设计文档：

| 开发模块 | AI 应主动检索的文档 |
|----------|---------------------|
| 应收账单（ArBill） | `aidocs/bms/design/bms-ar-bill-detail-page-design.md`, `aidocs/bms/design/uml/primary/应收账单状态机.md` |
| 核销（Payment/Writeoff） | `aidocs/bms/design/bms-bill-writeoff-design.md`, `aidocs/bms/design/uml/primary/费项支付方式.md` |
| 账单生成（BillGenerate） | `aidocs/bms/design/bms-bill-generation-design.md`, `aidocs/bms/design/bms-bill-generate-code-design.md`, `aidocs/bms/design/bms-bill-generate-task-monitor-design.md` |
| 费项（FeeDetail/FeeIndex） | `aidocs/bms/design/bms-consolidation-billing-design.md`, `aidocs/bms/design/bms-fee-source-dataset-design.md` |
| 多币种/汇率 | `aidocs/bms/design/bms-multi-currency-billing-design.md` |
| 结算条款（SettlementTerms） | `aidocs/bms/design/bms-consolidation-billing-prd.md`, `aidocs/bms/design/uml/secondary/线路计费核心配置.md` |
| 集运订单（MainOrder） | `aidocs/bms/design/uml/secondary/跨境集运全链路费项分解.md`, `aidocs/bms/design/uml/secondary/系统核心对象关系图.md` |
| 调账（FeeAdjustment） | `aidocs/bms/design/bms-ar-bill-detail-page-design.md`, `aidocs/bms/design/uml/primary/应收账单状态机.md` |
| 报表导出 | `aidocs/bms/design/uml/secondary/订单费用报表财务字段.md` |
| 全局/跨模块 | `aidocs/bms/design/PRD.md`, `aidocs/bms/design/uml/primary/业财一体流程图.md` |

### 8.5 大需求先出落地方案再编码

判断本次需求较大时，必须先充分考虑当前业务场景，结合现有代码输出需求落地方案、调整计划与疑问点，再进入编码。

**大需求判定**（满足任意一条即视为大需求）：

- 新增业务模块或跨模块改造，前后端同时调整
- 涉及多张表结构变更、数据迁移或存量数据口径调整
- 涉及金额、汇率、状态机、核销、账期等核心业务口径
- 存在需要产品、财务或外部系统确认的业务口径
- 改动面广、回归风险高

**必选动作**：

1. 先梳理当前业务场景：需求/PRD、`aidocs/bms/design/` 设计文档、`aidocs/technical-caliber/bms/dev-specs/` 已有方案、现有代码和数据库表结构。
2. 在 `aidocs/technical-caliber/bms/dev-specs/` 新建方案，文件名为 `yyyy-MM-dd-bms-{模块}-{需求名}需求落地方案及调整计划.md`，日期取当天（如 `2026-08-19-bms-xxx需求落地方案及调整计划.md`）。
3. 方案至少包含：需求背景与目标边界、业务场景与口径、现状分析（基于现有代码/表结构）、落地方案（后端/前端/DB/接口）、调整计划、疑问点（候选方案与推荐默认值）。
4. 落地方案与疑问点确认前，不得直接进入大规模编码；简单、小范围需求可不强制。

---

## 九、代码审查清单

每次提交 BMS 代码前，逐项确认：

| # | 检查项 | |
|---|--------|---|
| 1 | 实体类字段均使用标准多行 JavaDoc | ☐ |
| 2 | DTO 字段和辅助方法均使用标准多行 JavaDoc | ☐ |
| 3 | 请求数据隔离三字段 `scId`/`shopId`/`userId` | ☐ |
| 4 | 写操作 `@Transactional(rollbackFor = Exception.class)` | ☐ |
| 5 | 金额字段 `BigDecimal`，数据库 `DECIMAL(18,4)` | ☐ |
| 6 | 分页 DTO 含 `getOffset()`/`getLimit()`，上限 200 | ☐ |
| 7 | Service 入参 null 防御 | ☐ |
| 8 | SQL 动态条件写在 XML `<if>` 标签中，**禁止 SqlProvider 拼串** | ☐ |
| 9 | XML 中数据隔离条件在 WHERE 最前面 | ☐ |
| 10 | XML 使用 `<sql>` + `<include>` 复用列和条件片段 | ☐ |
| 11 | XML 使用 `<resultMap>` 显式映射，不用 `resultType` 自动映射 | ☐ |
| 12 | INSERT 使用 `useGeneratedKeys` 回写主键 | ☐ |
| 13 | Controller 实现 Feign 契约接口 | ☐ |
| 14 | Controller 写操作 POST + RequestBody | ☐ |
| 15 | URL kebab-case `/api/bms/xxx-yyy` | ☐ |
| 16 | 逻辑删除 `is_deleted = 0` 条件 | ☐ |
| 17 | 状态常量提取到常量类/枚举，禁止魔法值 | ☐ |
| 18 | Feign Client `@FeignClient(name="tmall-bms-service")` | ☐ |
| 19 | 前端 API 放 `src/api/`，用 `request` 封装 | ☐ |
| 20 | 前端路由 `meta.code` 与后端权限码一致 | ☐ |
| 21 | 无 Map 作为返回类型或参数 | ☐ |
| 22 | 无 SQL 函数作用在 WHERE 列上 | ☐ |
| 23 | 业务流程变更已同步到 `aidocs/bms/design/` 对应文档 | ☐ |
| 24 | 涉及库表结构变更时，已将完整最新表结构同步到 `aidocs/technical-caliber/sql/ar_bill.sql` | ☐ |
| 25 | Mapper、Service 私有方法、Feign API、Controller API 均有标准多行 JavaDoc | ☐ |
| 26 | 核心业务逻辑关键行/分支有简明 `//` 行内注释，状态/币种常量均有业务注释 | ☐ |
| 27 | XML 文件名符合 `Xxx-mapper.xml`，且 `mapper-locations` 为 `classpath:sqlmap/*-mapper.xml` | ☐ |
| 28 | 业务校验失败统一抛出 `BusinessException(code, message)`，禁止 `IllegalArgumentException` | ☐ |
| 29 | 大需求已在 `aidocs/technical-caliber/bms/dev-specs/` 输出日期开头的落地方案，含调整计划与疑问点 | ☐ |

---

## 八、参考文件

- 详细开发规范: `aidocs/technical-caliber/bms/skill/bms-fullstack-dev-spec.md`
- 应收账单 Mapper 接口: `bms/dao/src/main/java/com/szt/supplychain/bms/dao/mapper/ArBillMapper.java`
- 应收账单 XML Mapper: `bms/dao/src/main/resources/sqlmap/ArBill-mapper.xml`
- 应收账单 Service: `bms/biz/src/main/java/com/szt/supplychain/bms/biz/service/impl/ArBillServiceImpl.java`
- 应收账单 Controller: `bms/web/src/main/java/com/szt/supplychain/bms/web/controller/ArBillController.java`
- 应收账单 Feign Client: `bms/client/src/main/java/com/szt/supplychain/bms/client/api/ArBillRemoteService.java`
- 应收账单实体: `bms/model/src/main/java/com/szt/supplychain/bms/model/ArBill.java`
- 应收账单 DTO: `bms/model/src/main/java/com/szt/supplychain/bms/model/dto/ArBillQueryReqDTO.java`
