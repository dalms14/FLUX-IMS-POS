# FLUX POS Entity Relationship Diagram

This ERD is based on the current MongoDB/Mongoose models used by the FLUX POS system.

```mermaid
erDiagram
    USER {
        ObjectId _id PK
        string userId UK
        string name
        string email
        string password
        string role
        string pin
        string profileImage
        boolean isOnline
        date lastSeenAt
        date createdAt
        date updatedAt
    }

    CATEGORY {
        ObjectId _id PK
        string name
    }

    PRODUCT {
        ObjectId _id PK
        string name
        number price
        number soloPrice
        number platterPrice
        string category
        ObjectId categoryId FK
        string description
        string[] variants
        array addons
        string image
        string status
        boolean available
        date createdAt
        date updatedAt
    }

    ADDON {
        ObjectId _id PK
        string name
        string nameKey UK
        number price
        boolean active
        date createdAt
        date updatedAt
    }

    INVENTORY {
        ObjectId _id PK
        string name UK
        string unit
        number stock
        number lowStockAt
        string category
        date createdAt
        date updatedAt
    }

    RECIPE {
        ObjectId _id PK
        ObjectId productId FK
        string productName
        array ingredients
        date createdAt
        date updatedAt
    }

    TRANSACTION {
        ObjectId _id PK
        string receiptNo UK
        string cashier
        string cashierEmail
        string customerType
        object eliteMember
        object discountInfo
        array items
        number subtotal
        number tax
        number discount
        number total
        string paymentMethod
        number amountTendered
        number change
        string gcashReference
        string gcashProofImage
        date createdAt
        date updatedAt
    }

    REFUND {
        ObjectId _id PK
        ObjectId transactionId FK
        string receiptNo
        array items
        string reason
        number subtotal
        number tax
        number totalRefunded
        string refundedBy
        string refundedByEmail
        string paymentMethod
        string status
        date createdAt
        date updatedAt
    }

    WASTE {
        ObjectId _id PK
        ObjectId refundId FK
        ObjectId transactionId FK
        string receiptNo
        array items
        string reason
        string disposedBy
        string notes
        date createdAt
        date updatedAt
    }

    DISCOUNT {
        ObjectId _id PK
        string name
        string nameKey UK
        number percentage
        boolean active
        date createdAt
        date updatedAt
    }

    LOGIN_ACTIVITY {
        ObjectId _id PK
        ObjectId userId FK
        string name
        string email
        string role
        string action
        string staffId
        string ipAddress
        string userAgent
        date createdAt
        date updatedAt
    }

    SYSTEM_AUDIT {
        ObjectId _id PK
        string module
        string action
        string entityId
        string entityName
        string actor
        string actorEmail
        string details
        object changes
        date createdAt
        date updatedAt
    }

    CATEGORY ||--o{ PRODUCT : classifies
    PRODUCT ||--o| RECIPE : has
    INVENTORY ||--o{ RECIPE : used_in
    PRODUCT ||--o{ TRANSACTION : sold_as_item
    TRANSACTION ||--o{ REFUND : may_have
    PRODUCT ||--o{ REFUND : refunded_as_item
    REFUND ||--o| WASTE : may_create
    TRANSACTION ||--o{ WASTE : may_create
    INVENTORY ||--o{ WASTE : wasted_as_item
    USER ||--o{ LOGIN_ACTIVITY : records
```

## Main Relationships

- One category can have many products.
- One product can have one recipe.
- One recipe can contain many inventory ingredients.
- One transaction can contain many sold products.
- One transaction can have many refunds.
- One refund can create one waste record.
- One waste record can contain many wasted inventory items.
- One user can have many login activity records.

## Notes

- `Transaction.items`, `Refund.items`, `Waste.items`, `Product.addons`, and `Recipe.ingredients` are embedded arrays in MongoDB.
- `receiptNo` is retained as the internal field name in the database, but the UI displays it as `Slip No`.
- `SystemAudit` is a flexible audit table. It stores the affected entity through `entityId` and `entityName` instead of a strict foreign key.
