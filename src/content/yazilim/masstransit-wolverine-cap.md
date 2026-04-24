---
title: '.NET Dünyasında Mesajlaşma Kütüphaneleri: MassTransit Sonrası Wolverine ve CAP'
description: 'MassTransit v9 ticari lisans modeliyle birlikte öne çıkan açık kaynaklı alternatifler: Wolverine ve DotNetCore.CAP karşılaştırması'
pubDate: 2026-04-24
---

Dağıtık sistemler ve mikroservis mimarilerinde mesajlaşma (messaging), servisler arası iletişimin omurgasını oluşturur. Uzun yıllardır bu alanın lideri olan MassTransit'in v9 sürümü ile ticari lisanslama modeline (yıllık 1M$ gelir sınırı) geçmesi, birçok geliştiriciyi tamamen açık kaynaklı ve ücretsiz alternatiflere yöneltti.

Bu yazıda, modern .NET ekosisteminin yükselen yıldızları **Wolverine** ve **DotNetCore.CAP** kütüphanelerini mercek altına alacağız.

---

## 1. Wolverine: "Low Ceremony" ve Yüksek Performans

Eski adıyla Jasper olan Wolverine, Jeremy Miller tarafından geliştirilen ve "düşük seremoni" (low ceremony) felsefesini benimseyen bir kütüphanedir. MediatR gibi bir uygulama içi komut veri yolu (In-Memory Bus) ile MassTransit gibi harici bir mesajlaşma kütüphanesinin hibrit bir birleşimi gibidir.

### Öne Çıkan Özellikler

**No-Interface Yaklaşımı:** `IHandler` veya `IConsumer` gibi arayüzleri kalıtım almanıza gerek yoktur. Metot isimleri üzerinden (Convention-based) eşleşme yapar.

**Kod Üretimi (Code Generation):** Çalışma zamanında (runtime) yansıma (reflection) kullanmak yerine, Lamar kullanarak optimize edilmiş C# kodları üretir ve derler.

**Transactional Outbox:** EF Core ve PostgreSQL/SQL Server ile çok sıkı ve "görünmez" bir entegrasyona sahiptir.

### Kod Örneği: Wolverine Kurulumu ve Handler

```csharp
// Program.cs - Konfigürasyon
builder.Host.UseWolverine(opts =>
{
    // PostgreSQL ve EF Core Outbox entegrasyonu
    opts.PersistMessagesWithPostgresql(builder.Configuration.GetConnectionString("Default"));
    opts.UseEntityFrameworkCoreOutbox<AppDbContext>();
    
    // RabbitMQ Transport katmanı
    opts.UseRabbitMq(new Uri("amqp://guest:guest@localhost"))
        .AutoProvision();

    // Belirli bir mesajı RabbitMQ kuyruğuna yönlendir
    opts.PublishMessage<OrderCreated>().ToRabbitQueue("orders");
});

// Handler Sınıfı
public class OrderHandler
{
    // Arayüz yok! [Transactional] ile Outbox garantisi sağlanır.
    [Transactional]
    public async Task Handle(CreateOrder command, AppDbContext dbContext, IMessageContext bus)
    {
        var order = new Order(command.Id, command.CustomerName);
        dbContext.Orders.Add(order);
        
        // Bu mesaj, DB işlemiyle aynı transaction içinde 'Outbox' tablosuna yazılır.
        await bus.PublishAsync(new OrderCreated(order.Id));
        
        await dbContext.SaveChangesAsync();
    }
}
```

---

## 2. DotNetCore.CAP: Dağıtık İşlemlerin Ustası

CAP (Consistent Application Processing), özellikle dağıtık sistemlerde veri tutarlılığını sağlamaya ve "At-least-once delivery" (en az bir kez teslimat) garantisi sunmaya odaklanmış bir kütüphanedir.

### Öne Çıkan Özellikler

**Yerleşik Dashboard:** Mesajların durumunu, hataları ve başarı oranlarını izleyebileceğiniz çok kullanışlı bir UI ile gelir.

**Veri Tabanı Odaklı:** Outbox pattern'i kütüphanenin kalbine yerleştirmiştir.

**Kolay Konfigürasyon:** Kurulumu ve RabbitMQ/Kafka entegrasyonu oldukça basittir.

### Kod Örneği: CAP Kurulumu ve Kullanımı

```csharp
// Program.cs - Konfigürasyon
builder.Services.AddCap(x =>
{
    // Veri tabanı ve Outbox tabloları için PostgreSQL
    x.UseEntityFramework<AppDbContext>();
    x.UsePostgreSql(builder.Configuration.GetConnectionString("Default"));
    
    // Transport için RabbitMQ
    x.UseRabbitMQ("localhost");

    // İzleme paneli (Dashboard)
    x.UseDashboard();
});

// Producer (Mesaj Gönderimi)
public async Task CreateOrder(ICapPublisher capBus, AppDbContext dbContext)
{
    // Transaction yönetimi CAP ile entegre edilir
    using (var trans = dbContext.Database.BeginTransaction(capBus, autoCommit: true))
    {
        dbContext.Orders.Add(new Order { /* ... */ });
        await dbContext.SaveChangesAsync();

        // Mesaj Outbox tablosuna (Cap.Published) yazılır.
        await capBus.PublishAsync("order.created", new { Id = 1 });
    }
}

// Consumer (Mesaj Alımı)
public class OrderConsumer : ICapSubscribe
{
    [CapSubscribe("order.created")]
    public void HandleOrderCreated(object message)
    {
        // Gelen mesaj 'Cap.Received' tablosunda işaretlenir (Inbox).
        Console.WriteLine("Mesaj alındı!");
    }
}
```

---

## Outbox ve Inbox Pattern İlişkisi

Mikroservisler arasındaki en büyük sorun, bir veri tabanı işlemiyle bir mesaj gönderme işleminin aynı anda başarısız olması durumunda ortaya çıkan tutarsızlıktır.

**Wolverine'de Outbox:** Wolverine, mesajı PostgreSQL'deki kendi tablolarına yazar. İşlem başarılıysa mesaj arka planda RabbitMQ'ya fırlatılır. Wolverine bu süreci "Auto-Apply Transactions" özelliği ile neredeyse sihirli bir şekilde otomatikleştirir.

**CAP'te Outbox ve Inbox:** CAP, hem gönderilen (`Cap.Published`) hem de gelen (`Cap.Received`) mesajları veri tabanında saklayarak çift taraflı bir garanti sunar.

---

## Hangisini Seçmeli?

| Özellik | Wolverine | DotNetCore.CAP |
|---|---|---|
| **Bağımlılık** | Arayüz gerektirmez (POCO) | `ICapSubscribe` arayüzü gerekir |
| **Performans** | Çok Yüksek (Pre-compiled code) | Yüksek (Standard) |
| **İzlenebilirlik** | OpenTelemetry/Grafana odaklı | Yerleşik Dashboard (UI) |
| **Kod Yazımı** | Minimalist ve Hızlı | Belirgin (Explicit) Transaction yönetimi |

---

## Özet

Eğer modern, minimalist ve "altyapı kodum iş mantığımı kirletmesin" diyen bir yaklaşım istiyorsanız **Wolverine** sizin için en iyi tercihtir. Ancak "benim için en önemli şey mesajın ulaştığından emin olmak ve bunu bir panelden izlemek" diyorsanız **DotNetCore.CAP** projeniz için daha güvenli bir liman olacaktır.

Her iki kütüphane de tamamen açık kaynaklıdır ve MassTransit'in yeni lisans modeline karşı çok güçlü, ücretsiz alternatiflerdir.
